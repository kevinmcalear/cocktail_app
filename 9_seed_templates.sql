WITH new_template AS (
    INSERT INTO public.menu_templates (name, description) 
    VALUES ('Caretakers Cottage Format', 'The iconic 8-drink list: 1 Martini, 3 Moderns, 3 Classics, 1 Punch.')
    RETURNING id
)
INSERT INTO public.template_sections (template_id, name, min_items, max_items, sort_order)
SELECT id, 'House Martini', 1, 1, 0 FROM new_template UNION ALL
SELECT id, 'Modern Riff', 3, 3, 1 FROM new_template UNION ALL
SELECT id, 'Classic Riff', 3, 3, 2 FROM new_template UNION ALL
SELECT id, 'Milk Punch', 1, 1, 3 FROM new_template;
