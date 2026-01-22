import csv
import uuid
import re
import os

# File paths
CSV_FILE = 'cocktail_seeds.csv'
OUTPUT_DIR = 'seed_chunks'

# Create output dir if not exists
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

MAX_LINES_PER_FILE = 200

def escape_sql(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

def parse_spec(spec_text):
    """
    Attempts to parse a spec string into ingredients and amounts.
    """
    ingredients = []
    if not spec_text:
        return ingredients
    
    lines = spec_text.splitlines()
    if not lines:
        lines = spec_text.split(',') 
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        match = re.search(r'^([\d\./]+)\s*([a-zA-Z%]+)?\s+(.*)', line)
        
        ml = None
        dash = None
        amount = None
        ingredient_name = line
        
        if match:
            qty_str = match.group(1)
            unit_str = match.group(2)
            name_str = match.group(3)
            
            try:
                # Basic float conversion, handling likely fraction formats could be added but skipping for simplicity
                val = float(eval(qty_str)) 
            except:
                val = None
                
            if val is not None:
                ingredient_name = name_str
                if unit_str and unit_str.lower() in ['ml', 'mls', 'oz', 'cl']:
                    ml = val
                elif unit_str and 'dash' in unit_str.lower():
                    dash = val
                else:
                    amount = val
                    if unit_str: 
                         ingredient_name = f"{unit_str} {name_str}"
        
        ingredients.append({
            'name': ingredient_name.strip(),
            'ml': ml,
            'dash': dash,
            'amount': amount,
            'original_line': line
        })
            
    return ingredients

def write_chunks(all_statements):
    chunk_idx = 1
    current_lines = 0
    current_file_handle = None

    def open_next_file():
        nonlocal chunk_idx, current_lines, current_file_handle
        if current_file_handle:
            current_file_handle.close()
        
        filename = f"{OUTPUT_DIR}/seed_part_{chunk_idx:03d}.sql"
        print(f"Writing to {filename}...")
        current_file_handle = open(filename, 'w', encoding='utf-8')
        current_lines = 0
        chunk_idx += 1

    open_next_file()

    for statement in all_statements:
        # Check line count approximation (1 statement can be multiple lines)
        stmt_lines = statement.count('\n') + 1
        
        if current_lines + stmt_lines > MAX_LINES_PER_FILE and current_lines > 0:
            open_next_file()
            
        current_file_handle.write(statement + "\n")
        current_lines += stmt_lines

    if current_file_handle:
        current_file_handle.close()

def main():
    methods = set()
    glassware = set()
    families = set()
    all_ingredients = set()
    cocktails = []
    
    print("Reading CSV...")
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Method']: methods.add(row['Method'].strip())
            if row['Glassware']: glassware.add(row['Glassware'].strip())
            if row['Family']: families.add(row['Family'].strip())
            
            specs = parse_spec(row['Spec'])
            for spec in specs:
                all_ingredients.add(spec['name'])
            
            cocktails.append({
                'row': row,
                'specs': specs
            })

    sql_statements = []

    # 1. Lookups
    sql_statements.append("-- Methods")
    for m in methods:
        sql_statements.append(f"INSERT INTO methods (name) VALUES ({escape_sql(m)}) ON CONFLICT (name) DO NOTHING;")
        
    sql_statements.append("\n-- Glassware")
    for g in glassware:
        sql_statements.append(f"INSERT INTO glassware (name) VALUES ({escape_sql(g)}) ON CONFLICT (name) DO NOTHING;")
        
    sql_statements.append("\n-- Families")
    for fam in families:
        sql_statements.append(f"INSERT INTO families (name) VALUES ({escape_sql(fam)}) ON CONFLICT (name) DO NOTHING;")
        
    sql_statements.append("\n-- Ingredients")
    for ing in all_ingredients:
        sql_statements.append(f"INSERT INTO ingredients (name) VALUES ({escape_sql(ing)}) ON CONFLICT (name) DO NOTHING;")

    # 2. Cocktails & Recipes
    # We use subqueries for IDs instead of variables to remain stateless across files
    sql_statements.append("\n-- Cocktails and Recipes")
    
    for item in cocktails:
        row = item['row']
        name = row['Drink name']
        if not name: continue
        
        method_sql = f"(SELECT id FROM methods WHERE name = {escape_sql(row['Method'].strip())})" if row['Method'] else "NULL"
        glass_sql = f"(SELECT id FROM glassware WHERE name = {escape_sql(row['Glassware'].strip())})" if row['Glassware'] else "NULL"
        family_sql = f"(SELECT id FROM families WHERE name = {escape_sql(row['Family'].strip())})" if row['Family'] else "NULL"
        
        # Insert Cocktail
        # Note: We assume name is UNIQUE or has a constraint. The previous script used ON CONFLICT(name).
        # To be safe for re-runs, we keep ON CONFLICT.
        insert_cocktail = f"""
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ({escape_sql(name)}, {escape_sql(row['Notes'])}, {escape_sql(row['Origin'])}, {escape_sql(row['garnish'])}, {escape_sql(row['Spec'])}, {method_sql}, {glass_sql}, {family_sql})
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
"""
        sql_statements.append(insert_cocktail.strip())

        # Insert Recipes
        if item['specs']:
            # Delete existing recipes to avoid duplicates
            sql_statements.append(f"DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = {escape_sql(name)});")
            
            for spec in item['specs']:
                ing_name = spec['name']
                ml = spec['ml'] if spec['ml'] else 'NULL'
                dash = spec['dash'] if spec['dash'] else 'NULL'
                amount = spec['amount'] if spec['amount'] else 'NULL'
                
                insert_recipe = f"""
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = {escape_sql(name)}),
    (SELECT id FROM ingredients WHERE name = {escape_sql(ing_name)}),
    {ml}, {dash}, {amount}
);
"""
                sql_statements.append(insert_recipe.strip())

    print(f"Total SQL statements generated: {len(sql_statements)}")
    write_chunks(sql_statements)
    print("Done!")

if __name__ == '__main__':
    main()
