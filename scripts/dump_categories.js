const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('domain', 'spirit');

  if (catError) {
    console.error('Error fetching categories:', catError);
    return;
  }

  const { data: items, error: itemError } = await supabase
    .from('items')
    .select('id, name, item_type, item_categories(*)');

  if (itemError) {
    console.error('Error fetching items:', itemError);
    return;
  }

  const roots = categories.filter(c => !c.parent_id);
  const getChildren = (parentId) => categories.filter(c => c.parent_id === parentId);

  const itemsByCategoryId = {};
  items.forEach(item => {
    // Only looking at ingredients.
    if (item.item_type !== 'ingredient') return;
    
    (item.item_categories || []).forEach(ic => {
      if (!itemsByCategoryId[ic.category_id]) {
        itemsByCategoryId[ic.category_id] = [];
      }
      itemsByCategoryId[ic.category_id].push(item.name);
    });
  });

  function printNode(node, prefix = '') {
    console.log(`${prefix}- ${node.name} (Category)`);
    
    // Print subcategories first
    const children = getChildren(node.id);
    children.forEach(child => {
      printNode(child, prefix + '  ');
    });
    
    // Print items under this category
    const categoryItems = itemsByCategoryId[node.id] || [];
    categoryItems.forEach(itemName => {
      console.log(`${prefix}  * ${itemName}`);
    });
  }

  console.log('--- Diagram: Spirit Organization ---');
  roots.forEach(root => {
    printNode(root, '');
  });
}

main();
