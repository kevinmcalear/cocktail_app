-- DEDUPLICATE INGREDIENTS SCRIPT
-- Generated based on current duplicate names (case-insensitive fallback)
BEGIN;

-- Merging duplicates for: "absinthe" into canonical ID: 3a856c73-3e6b-43cc-9de9-9e2721864083 ("Absinthe")
-- Removing duplicate: "absinthe" (a597e3f0-8eb4-46fb-9a13-a146acce86a3)
  UPDATE recipes SET ingredient_id = '3a856c73-3e6b-43cc-9de9-9e2721864083' WHERE ingredient_id = 'a597e3f0-8eb4-46fb-9a13-a146acce86a3';
  UPDATE recipes SET parent_ingredient_id = '3a856c73-3e6b-43cc-9de9-9e2721864083' WHERE parent_ingredient_id = 'a597e3f0-8eb4-46fb-9a13-a146acce86a3';
  UPDATE cocktails SET garnish_id = '3a856c73-3e6b-43cc-9de9-9e2721864083' WHERE garnish_id = 'a597e3f0-8eb4-46fb-9a13-a146acce86a3';
  DELETE FROM ingredients WHERE id = 'a597e3f0-8eb4-46fb-9a13-a146acce86a3';

-- Merging duplicates for: "agave" into canonical ID: dbd2fc43-6fd0-46a3-aefe-a4d50af3e2fb ("Agave")
-- Removing duplicate: "agave" (ad677007-7a03-4cfe-b1db-baf85d12c37d)
  UPDATE recipes SET ingredient_id = 'dbd2fc43-6fd0-46a3-aefe-a4d50af3e2fb' WHERE ingredient_id = 'ad677007-7a03-4cfe-b1db-baf85d12c37d';
  UPDATE recipes SET parent_ingredient_id = 'dbd2fc43-6fd0-46a3-aefe-a4d50af3e2fb' WHERE parent_ingredient_id = 'ad677007-7a03-4cfe-b1db-baf85d12c37d';
  UPDATE cocktails SET garnish_id = 'dbd2fc43-6fd0-46a3-aefe-a4d50af3e2fb' WHERE garnish_id = 'ad677007-7a03-4cfe-b1db-baf85d12c37d';
  DELETE FROM ingredients WHERE id = 'ad677007-7a03-4cfe-b1db-baf85d12c37d';

-- Merging duplicates for: "aged rum" into canonical ID: d681586c-4956-46cd-a0f3-bfba09088f35 ("Aged Rum")
-- Removing duplicate: "aged rum" (c73dfcf6-71b7-470e-864a-0886195c2bee)
  UPDATE recipes SET ingredient_id = 'd681586c-4956-46cd-a0f3-bfba09088f35' WHERE ingredient_id = 'c73dfcf6-71b7-470e-864a-0886195c2bee';
  UPDATE recipes SET parent_ingredient_id = 'd681586c-4956-46cd-a0f3-bfba09088f35' WHERE parent_ingredient_id = 'c73dfcf6-71b7-470e-864a-0886195c2bee';
  UPDATE cocktails SET garnish_id = 'd681586c-4956-46cd-a0f3-bfba09088f35' WHERE garnish_id = 'c73dfcf6-71b7-470e-864a-0886195c2bee';
  DELETE FROM ingredients WHERE id = 'c73dfcf6-71b7-470e-864a-0886195c2bee';

-- Merging duplicates for: "ango" into canonical ID: 0eb69fc9-f6f9-4556-97d7-c73c586da0ca ("Ango")
-- Removing duplicate: "ango" (f5c579fd-d798-4a50-9f3b-b8c5ba959f3e)
  UPDATE recipes SET ingredient_id = '0eb69fc9-f6f9-4556-97d7-c73c586da0ca' WHERE ingredient_id = 'f5c579fd-d798-4a50-9f3b-b8c5ba959f3e';
  UPDATE recipes SET parent_ingredient_id = '0eb69fc9-f6f9-4556-97d7-c73c586da0ca' WHERE parent_ingredient_id = 'f5c579fd-d798-4a50-9f3b-b8c5ba959f3e';
  UPDATE cocktails SET garnish_id = '0eb69fc9-f6f9-4556-97d7-c73c586da0ca' WHERE garnish_id = 'f5c579fd-d798-4a50-9f3b-b8c5ba959f3e';
  DELETE FROM ingredients WHERE id = 'f5c579fd-d798-4a50-9f3b-b8c5ba959f3e';

-- Merging duplicates for: "angostura bitters" into canonical ID: d2f0028f-5995-45a7-b054-154ed389bda0 ("Angostura bitters")
-- Removing duplicate: "Angostura Bitters" (e31b47a5-9c3c-44ba-aa25-1c4746a02e1f)
  UPDATE recipes SET ingredient_id = 'd2f0028f-5995-45a7-b054-154ed389bda0' WHERE ingredient_id = 'e31b47a5-9c3c-44ba-aa25-1c4746a02e1f';
  UPDATE recipes SET parent_ingredient_id = 'd2f0028f-5995-45a7-b054-154ed389bda0' WHERE parent_ingredient_id = 'e31b47a5-9c3c-44ba-aa25-1c4746a02e1f';
  UPDATE cocktails SET garnish_id = 'd2f0028f-5995-45a7-b054-154ed389bda0' WHERE garnish_id = 'e31b47a5-9c3c-44ba-aa25-1c4746a02e1f';
  DELETE FROM ingredients WHERE id = 'e31b47a5-9c3c-44ba-aa25-1c4746a02e1f';

-- Merging duplicates for: "applejack" into canonical ID: 8e8f4c8d-05eb-46a8-b824-a96febc40147 ("Applejack")
-- Removing duplicate: "applejack" (499e594b-0bac-4079-b636-7272874000fb)
  UPDATE recipes SET ingredient_id = '8e8f4c8d-05eb-46a8-b824-a96febc40147' WHERE ingredient_id = '499e594b-0bac-4079-b636-7272874000fb';
  UPDATE recipes SET parent_ingredient_id = '8e8f4c8d-05eb-46a8-b824-a96febc40147' WHERE parent_ingredient_id = '499e594b-0bac-4079-b636-7272874000fb';
  UPDATE cocktails SET garnish_id = '8e8f4c8d-05eb-46a8-b824-a96febc40147' WHERE garnish_id = '499e594b-0bac-4079-b636-7272874000fb';
  DELETE FROM ingredients WHERE id = '499e594b-0bac-4079-b636-7272874000fb';

-- Merging duplicates for: "apricot" into canonical ID: dd7f8d80-ba65-4961-95c1-6cb665b69c3a ("Apricot")
-- Removing duplicate: "apricot" (6186f640-5874-4c89-9796-c97d4a39d0f6)
  UPDATE recipes SET ingredient_id = 'dd7f8d80-ba65-4961-95c1-6cb665b69c3a' WHERE ingredient_id = '6186f640-5874-4c89-9796-c97d4a39d0f6';
  UPDATE recipes SET parent_ingredient_id = 'dd7f8d80-ba65-4961-95c1-6cb665b69c3a' WHERE parent_ingredient_id = '6186f640-5874-4c89-9796-c97d4a39d0f6';
  UPDATE cocktails SET garnish_id = 'dd7f8d80-ba65-4961-95c1-6cb665b69c3a' WHERE garnish_id = '6186f640-5874-4c89-9796-c97d4a39d0f6';
  DELETE FROM ingredients WHERE id = '6186f640-5874-4c89-9796-c97d4a39d0f6';

-- Merging duplicates for: "apry" into canonical ID: dc518492-83e5-487b-b8aa-40fd254fb016 ("Apry")
-- Removing duplicate: "apry" (45e64e79-9e96-4f8c-8fdf-614108a5997b)
  UPDATE recipes SET ingredient_id = 'dc518492-83e5-487b-b8aa-40fd254fb016' WHERE ingredient_id = '45e64e79-9e96-4f8c-8fdf-614108a5997b';
  UPDATE recipes SET parent_ingredient_id = 'dc518492-83e5-487b-b8aa-40fd254fb016' WHERE parent_ingredient_id = '45e64e79-9e96-4f8c-8fdf-614108a5997b';
  UPDATE cocktails SET garnish_id = 'dc518492-83e5-487b-b8aa-40fd254fb016' WHERE garnish_id = '45e64e79-9e96-4f8c-8fdf-614108a5997b';
  DELETE FROM ingredients WHERE id = '45e64e79-9e96-4f8c-8fdf-614108a5997b';

-- Merging duplicates for: "benedictine" into canonical ID: a64afdfc-4dac-4db8-8115-fc3244d2ac9e ("Benedictine")
-- Removing duplicate: "benedictine" (84c75633-2953-4ae3-b345-5c0dee786083)
  UPDATE recipes SET ingredient_id = 'a64afdfc-4dac-4db8-8115-fc3244d2ac9e' WHERE ingredient_id = '84c75633-2953-4ae3-b345-5c0dee786083';
  UPDATE recipes SET parent_ingredient_id = 'a64afdfc-4dac-4db8-8115-fc3244d2ac9e' WHERE parent_ingredient_id = '84c75633-2953-4ae3-b345-5c0dee786083';
  UPDATE cocktails SET garnish_id = 'a64afdfc-4dac-4db8-8115-fc3244d2ac9e' WHERE garnish_id = '84c75633-2953-4ae3-b345-5c0dee786083';
  DELETE FROM ingredients WHERE id = '84c75633-2953-4ae3-b345-5c0dee786083';

-- Merging duplicates for: "bourbon" into canonical ID: c164b8a9-20d9-4863-bc60-af73f75f386c ("Bourbon")
-- Removing duplicate: "bourbon" (5543a58e-3866-4820-bfa9-961d634cb521)
  UPDATE recipes SET ingredient_id = 'c164b8a9-20d9-4863-bc60-af73f75f386c' WHERE ingredient_id = '5543a58e-3866-4820-bfa9-961d634cb521';
  UPDATE recipes SET parent_ingredient_id = 'c164b8a9-20d9-4863-bc60-af73f75f386c' WHERE parent_ingredient_id = '5543a58e-3866-4820-bfa9-961d634cb521';
  UPDATE cocktails SET garnish_id = 'c164b8a9-20d9-4863-bc60-af73f75f386c' WHERE garnish_id = '5543a58e-3866-4820-bfa9-961d634cb521';
  DELETE FROM ingredients WHERE id = '5543a58e-3866-4820-bfa9-961d634cb521';

-- Merging duplicates for: "cacao" into canonical ID: 680fb274-f508-4a8d-9943-6f95be5f60f9 ("Cacao")
-- Removing duplicate: "cacao" (7b7446e4-5d20-4b3d-9f17-738a01122ee1)
  UPDATE recipes SET ingredient_id = '680fb274-f508-4a8d-9943-6f95be5f60f9' WHERE ingredient_id = '7b7446e4-5d20-4b3d-9f17-738a01122ee1';
  UPDATE recipes SET parent_ingredient_id = '680fb274-f508-4a8d-9943-6f95be5f60f9' WHERE parent_ingredient_id = '7b7446e4-5d20-4b3d-9f17-738a01122ee1';
  UPDATE cocktails SET garnish_id = '680fb274-f508-4a8d-9943-6f95be5f60f9' WHERE garnish_id = '7b7446e4-5d20-4b3d-9f17-738a01122ee1';
  DELETE FROM ingredients WHERE id = '7b7446e4-5d20-4b3d-9f17-738a01122ee1';

-- Merging duplicates for: "calvados" into canonical ID: 72d28ede-e128-426c-900e-cc9898dfb336 ("Calvados")
-- Removing duplicate: "calvados" (41e2a1d4-7aa4-4894-b526-aa694a6b36a0)
  UPDATE recipes SET ingredient_id = '72d28ede-e128-426c-900e-cc9898dfb336' WHERE ingredient_id = '41e2a1d4-7aa4-4894-b526-aa694a6b36a0';
  UPDATE recipes SET parent_ingredient_id = '72d28ede-e128-426c-900e-cc9898dfb336' WHERE parent_ingredient_id = '41e2a1d4-7aa4-4894-b526-aa694a6b36a0';
  UPDATE cocktails SET garnish_id = '72d28ede-e128-426c-900e-cc9898dfb336' WHERE garnish_id = '41e2a1d4-7aa4-4894-b526-aa694a6b36a0';
  DELETE FROM ingredients WHERE id = '41e2a1d4-7aa4-4894-b526-aa694a6b36a0';

-- Merging duplicates for: "campari" into canonical ID: 3177187a-daa7-41b3-aa69-3089ed0c6543 ("Campari")
-- Removing duplicate: "campari" (d8218343-8a6c-43ec-a6c7-1806abf7db46)
  UPDATE recipes SET ingredient_id = '3177187a-daa7-41b3-aa69-3089ed0c6543' WHERE ingredient_id = 'd8218343-8a6c-43ec-a6c7-1806abf7db46';
  UPDATE recipes SET parent_ingredient_id = '3177187a-daa7-41b3-aa69-3089ed0c6543' WHERE parent_ingredient_id = 'd8218343-8a6c-43ec-a6c7-1806abf7db46';
  UPDATE cocktails SET garnish_id = '3177187a-daa7-41b3-aa69-3089ed0c6543' WHERE garnish_id = 'd8218343-8a6c-43ec-a6c7-1806abf7db46';
  DELETE FROM ingredients WHERE id = 'd8218343-8a6c-43ec-a6c7-1806abf7db46';

-- Merging duplicates for: "champagne" into canonical ID: 220d011a-fe81-4d8e-95e5-af82b7ccf424 ("Champagne")
-- Removing duplicate: "champagne" (71b986a0-1e60-4bf1-af8d-4b00f82a2446)
  UPDATE recipes SET ingredient_id = '220d011a-fe81-4d8e-95e5-af82b7ccf424' WHERE ingredient_id = '71b986a0-1e60-4bf1-af8d-4b00f82a2446';
  UPDATE recipes SET parent_ingredient_id = '220d011a-fe81-4d8e-95e5-af82b7ccf424' WHERE parent_ingredient_id = '71b986a0-1e60-4bf1-af8d-4b00f82a2446';
  UPDATE cocktails SET garnish_id = '220d011a-fe81-4d8e-95e5-af82b7ccf424' WHERE garnish_id = '71b986a0-1e60-4bf1-af8d-4b00f82a2446';
  DELETE FROM ingredients WHERE id = '71b986a0-1e60-4bf1-af8d-4b00f82a2446';

-- Merging duplicates for: "cocchi americano" into canonical ID: a7539131-5c1c-4b36-8bbb-44626607f785 ("Cocchi Americano")
-- Removing duplicate: "cocchi americano" (a7d0f2d6-5d90-4642-94ba-dff2a27862a2)
  UPDATE recipes SET ingredient_id = 'a7539131-5c1c-4b36-8bbb-44626607f785' WHERE ingredient_id = 'a7d0f2d6-5d90-4642-94ba-dff2a27862a2';
  UPDATE recipes SET parent_ingredient_id = 'a7539131-5c1c-4b36-8bbb-44626607f785' WHERE parent_ingredient_id = 'a7d0f2d6-5d90-4642-94ba-dff2a27862a2';
  UPDATE cocktails SET garnish_id = 'a7539131-5c1c-4b36-8bbb-44626607f785' WHERE garnish_id = 'a7d0f2d6-5d90-4642-94ba-dff2a27862a2';
  DELETE FROM ingredients WHERE id = 'a7d0f2d6-5d90-4642-94ba-dff2a27862a2';

-- Merging duplicates for: "cognac" into canonical ID: 687ebce6-4a62-4f4b-93ec-0c69574d7ca3 ("Cognac")
-- Removing duplicate: "cognac" (fc018aa6-8888-4955-97b3-0aada224c4b7)
  UPDATE recipes SET ingredient_id = '687ebce6-4a62-4f4b-93ec-0c69574d7ca3' WHERE ingredient_id = 'fc018aa6-8888-4955-97b3-0aada224c4b7';
  UPDATE recipes SET parent_ingredient_id = '687ebce6-4a62-4f4b-93ec-0c69574d7ca3' WHERE parent_ingredient_id = 'fc018aa6-8888-4955-97b3-0aada224c4b7';
  UPDATE cocktails SET garnish_id = '687ebce6-4a62-4f4b-93ec-0c69574d7ca3' WHERE garnish_id = 'fc018aa6-8888-4955-97b3-0aada224c4b7';
  DELETE FROM ingredients WHERE id = 'fc018aa6-8888-4955-97b3-0aada224c4b7';

-- Merging duplicates for: "cointreau" into canonical ID: 89ab8fb1-df0e-41dd-a94a-e91394ac91e2 ("Cointreau")
-- Removing duplicate: "cointreau" (b703dd3f-3020-4ab7-aa69-f04a95d3f879)
  UPDATE recipes SET ingredient_id = '89ab8fb1-df0e-41dd-a94a-e91394ac91e2' WHERE ingredient_id = 'b703dd3f-3020-4ab7-aa69-f04a95d3f879';
  UPDATE recipes SET parent_ingredient_id = '89ab8fb1-df0e-41dd-a94a-e91394ac91e2' WHERE parent_ingredient_id = 'b703dd3f-3020-4ab7-aa69-f04a95d3f879';
  UPDATE cocktails SET garnish_id = '89ab8fb1-df0e-41dd-a94a-e91394ac91e2' WHERE garnish_id = 'b703dd3f-3020-4ab7-aa69-f04a95d3f879';
  DELETE FROM ingredients WHERE id = 'b703dd3f-3020-4ab7-aa69-f04a95d3f879';

-- Merging duplicates for: "cointreu" into canonical ID: 6460d649-16d3-401a-80df-693dadcf4631 ("Cointreu")
-- Removing duplicate: "cointreu" (f5717187-c589-4463-9feb-4d4b009814a8)
  UPDATE recipes SET ingredient_id = '6460d649-16d3-401a-80df-693dadcf4631' WHERE ingredient_id = 'f5717187-c589-4463-9feb-4d4b009814a8';
  UPDATE recipes SET parent_ingredient_id = '6460d649-16d3-401a-80df-693dadcf4631' WHERE parent_ingredient_id = 'f5717187-c589-4463-9feb-4d4b009814a8';
  UPDATE cocktails SET garnish_id = '6460d649-16d3-401a-80df-693dadcf4631' WHERE garnish_id = 'f5717187-c589-4463-9feb-4d4b009814a8';
  DELETE FROM ingredients WHERE id = 'f5717187-c589-4463-9feb-4d4b009814a8';

-- Merging duplicates for: "dark rum" into canonical ID: 5308679a-de02-4ab4-bfda-b5c5af3ca787 ("Dark rum")
-- Removing duplicate: "dark rum" (68db8486-6ec3-45fe-b53b-285097d7ec85)
  UPDATE recipes SET ingredient_id = '5308679a-de02-4ab4-bfda-b5c5af3ca787' WHERE ingredient_id = '68db8486-6ec3-45fe-b53b-285097d7ec85';
  UPDATE recipes SET parent_ingredient_id = '5308679a-de02-4ab4-bfda-b5c5af3ca787' WHERE parent_ingredient_id = '68db8486-6ec3-45fe-b53b-285097d7ec85';
  UPDATE cocktails SET garnish_id = '5308679a-de02-4ab4-bfda-b5c5af3ca787' WHERE garnish_id = '68db8486-6ec3-45fe-b53b-285097d7ec85';
  DELETE FROM ingredients WHERE id = '68db8486-6ec3-45fe-b53b-285097d7ec85';

-- Merging duplicates for: "dash absinthe" into canonical ID: 4d66c291-f003-48f0-a68b-1ec9bbcc01ea ("Dash absinthe")
-- Removing duplicate: "dash absinthe" (a9d333f8-57b6-42a3-8015-bd1f642f2376)
  UPDATE recipes SET ingredient_id = '4d66c291-f003-48f0-a68b-1ec9bbcc01ea' WHERE ingredient_id = 'a9d333f8-57b6-42a3-8015-bd1f642f2376';
  UPDATE recipes SET parent_ingredient_id = '4d66c291-f003-48f0-a68b-1ec9bbcc01ea' WHERE parent_ingredient_id = 'a9d333f8-57b6-42a3-8015-bd1f642f2376';
  UPDATE cocktails SET garnish_id = '4d66c291-f003-48f0-a68b-1ec9bbcc01ea' WHERE garnish_id = 'a9d333f8-57b6-42a3-8015-bd1f642f2376';
  DELETE FROM ingredients WHERE id = 'a9d333f8-57b6-42a3-8015-bd1f642f2376';
-- Removing duplicate: "dash Absinthe" (a4c1f8d2-c84b-4387-ab4a-2fcde0ce00bb)
  UPDATE recipes SET ingredient_id = '4d66c291-f003-48f0-a68b-1ec9bbcc01ea' WHERE ingredient_id = 'a4c1f8d2-c84b-4387-ab4a-2fcde0ce00bb';
  UPDATE recipes SET parent_ingredient_id = '4d66c291-f003-48f0-a68b-1ec9bbcc01ea' WHERE parent_ingredient_id = 'a4c1f8d2-c84b-4387-ab4a-2fcde0ce00bb';
  UPDATE cocktails SET garnish_id = '4d66c291-f003-48f0-a68b-1ec9bbcc01ea' WHERE garnish_id = 'a4c1f8d2-c84b-4387-ab4a-2fcde0ce00bb';
  DELETE FROM ingredients WHERE id = 'a4c1f8d2-c84b-4387-ab4a-2fcde0ce00bb';

-- Merging duplicates for: "dash ango" into canonical ID: 0ff6328e-0815-4547-803f-a912e23795cb ("Dash ango")
-- Removing duplicate: "dash ango" (b0b911c1-a760-4a59-b90c-53624ddc0216)
  UPDATE recipes SET ingredient_id = '0ff6328e-0815-4547-803f-a912e23795cb' WHERE ingredient_id = 'b0b911c1-a760-4a59-b90c-53624ddc0216';
  UPDATE recipes SET parent_ingredient_id = '0ff6328e-0815-4547-803f-a912e23795cb' WHERE parent_ingredient_id = 'b0b911c1-a760-4a59-b90c-53624ddc0216';
  UPDATE cocktails SET garnish_id = '0ff6328e-0815-4547-803f-a912e23795cb' WHERE garnish_id = 'b0b911c1-a760-4a59-b90c-53624ddc0216';
  DELETE FROM ingredients WHERE id = 'b0b911c1-a760-4a59-b90c-53624ddc0216';
-- Removing duplicate: "dash Ango" (48764b44-0d08-49ce-92a5-29331ff451cb)
  UPDATE recipes SET ingredient_id = '0ff6328e-0815-4547-803f-a912e23795cb' WHERE ingredient_id = '48764b44-0d08-49ce-92a5-29331ff451cb';
  UPDATE recipes SET parent_ingredient_id = '0ff6328e-0815-4547-803f-a912e23795cb' WHERE parent_ingredient_id = '48764b44-0d08-49ce-92a5-29331ff451cb';
  UPDATE cocktails SET garnish_id = '0ff6328e-0815-4547-803f-a912e23795cb' WHERE garnish_id = '48764b44-0d08-49ce-92a5-29331ff451cb';
  DELETE FROM ingredients WHERE id = '48764b44-0d08-49ce-92a5-29331ff451cb';

-- Merging duplicates for: "dash orange" into canonical ID: bf69bd2a-9322-4faf-9903-f921ea613212 ("Dash orange")
-- Removing duplicate: "dash orange" (cd573c29-72f0-4701-8cb1-5bac4996c6d2)
  UPDATE recipes SET ingredient_id = 'bf69bd2a-9322-4faf-9903-f921ea613212' WHERE ingredient_id = 'cd573c29-72f0-4701-8cb1-5bac4996c6d2';
  UPDATE recipes SET parent_ingredient_id = 'bf69bd2a-9322-4faf-9903-f921ea613212' WHERE parent_ingredient_id = 'cd573c29-72f0-4701-8cb1-5bac4996c6d2';
  UPDATE cocktails SET garnish_id = 'bf69bd2a-9322-4faf-9903-f921ea613212' WHERE garnish_id = 'cd573c29-72f0-4701-8cb1-5bac4996c6d2';
  DELETE FROM ingredients WHERE id = 'cd573c29-72f0-4701-8cb1-5bac4996c6d2';

-- Merging duplicates for: "dom benedictine" into canonical ID: 408f8112-38fe-4128-8e66-5cdff07d365f ("Dom Benedictine")
-- Removing duplicate: "DOM Benedictine" (603a4f6a-b57e-4360-a46e-3ea868eb93c1)
  UPDATE recipes SET ingredient_id = '408f8112-38fe-4128-8e66-5cdff07d365f' WHERE ingredient_id = '603a4f6a-b57e-4360-a46e-3ea868eb93c1';
  UPDATE recipes SET parent_ingredient_id = '408f8112-38fe-4128-8e66-5cdff07d365f' WHERE parent_ingredient_id = '603a4f6a-b57e-4360-a46e-3ea868eb93c1';
  UPDATE cocktails SET garnish_id = '408f8112-38fe-4128-8e66-5cdff07d365f' WHERE garnish_id = '603a4f6a-b57e-4360-a46e-3ea868eb93c1';
  DELETE FROM ingredients WHERE id = '603a4f6a-b57e-4360-a46e-3ea868eb93c1';

-- Merging duplicates for: "dry curacao" into canonical ID: 6b94e717-b50a-4c3a-94c8-9989d827e6bf ("Dry Curacao")
-- Removing duplicate: "dry curacao" (2be0eda1-bfc0-4ccb-b3ac-af6deaf7bb28)
  UPDATE recipes SET ingredient_id = '6b94e717-b50a-4c3a-94c8-9989d827e6bf' WHERE ingredient_id = '2be0eda1-bfc0-4ccb-b3ac-af6deaf7bb28';
  UPDATE recipes SET parent_ingredient_id = '6b94e717-b50a-4c3a-94c8-9989d827e6bf' WHERE parent_ingredient_id = '2be0eda1-bfc0-4ccb-b3ac-af6deaf7bb28';
  UPDATE cocktails SET garnish_id = '6b94e717-b50a-4c3a-94c8-9989d827e6bf' WHERE garnish_id = '2be0eda1-bfc0-4ccb-b3ac-af6deaf7bb28';
  DELETE FROM ingredients WHERE id = '2be0eda1-bfc0-4ccb-b3ac-af6deaf7bb28';

-- Merging duplicates for: "dry triple sec" into canonical ID: 8b3f1c58-66e8-4226-a820-a244d0b0949d ("Dry triple sec")
-- Removing duplicate: "dry triple sec" (6ef480be-9dcf-47f9-8211-969659a77376)
  UPDATE recipes SET ingredient_id = '8b3f1c58-66e8-4226-a820-a244d0b0949d' WHERE ingredient_id = '6ef480be-9dcf-47f9-8211-969659a77376';
  UPDATE recipes SET parent_ingredient_id = '8b3f1c58-66e8-4226-a820-a244d0b0949d' WHERE parent_ingredient_id = '6ef480be-9dcf-47f9-8211-969659a77376';
  UPDATE cocktails SET garnish_id = '8b3f1c58-66e8-4226-a820-a244d0b0949d' WHERE garnish_id = '6ef480be-9dcf-47f9-8211-969659a77376';
  DELETE FROM ingredients WHERE id = '6ef480be-9dcf-47f9-8211-969659a77376';

-- Merging duplicates for: "dry vermouth" into canonical ID: 10a4d1aa-0409-4eee-ba48-80f73901e593 ("Dry vermouth")
-- Removing duplicate: "dry vermouth" (c5eba664-e2f3-4eeb-8aab-f9880606001e)
  UPDATE recipes SET ingredient_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE ingredient_id = 'c5eba664-e2f3-4eeb-8aab-f9880606001e';
  UPDATE recipes SET parent_ingredient_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE parent_ingredient_id = 'c5eba664-e2f3-4eeb-8aab-f9880606001e';
  UPDATE cocktails SET garnish_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE garnish_id = 'c5eba664-e2f3-4eeb-8aab-f9880606001e';
  DELETE FROM ingredients WHERE id = 'c5eba664-e2f3-4eeb-8aab-f9880606001e';
-- Removing duplicate: "dry Vermouth" (222a4301-6ac4-474e-ac20-e1bb2dd50609)
  UPDATE recipes SET ingredient_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE ingredient_id = '222a4301-6ac4-474e-ac20-e1bb2dd50609';
  UPDATE recipes SET parent_ingredient_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE parent_ingredient_id = '222a4301-6ac4-474e-ac20-e1bb2dd50609';
  UPDATE cocktails SET garnish_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE garnish_id = '222a4301-6ac4-474e-ac20-e1bb2dd50609';
  DELETE FROM ingredients WHERE id = '222a4301-6ac4-474e-ac20-e1bb2dd50609';
-- Removing duplicate: "Dry Vermouth" (10b47145-7b1f-46de-8c04-388fde986a27)
  UPDATE recipes SET ingredient_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE ingredient_id = '10b47145-7b1f-46de-8c04-388fde986a27';
  UPDATE recipes SET parent_ingredient_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE parent_ingredient_id = '10b47145-7b1f-46de-8c04-388fde986a27';
  UPDATE cocktails SET garnish_id = '10a4d1aa-0409-4eee-ba48-80f73901e593' WHERE garnish_id = '10b47145-7b1f-46de-8c04-388fde986a27';
  DELETE FROM ingredients WHERE id = '10b47145-7b1f-46de-8c04-388fde986a27';

-- Merging duplicates for: "egg white" into canonical ID: bd246b68-e854-4bfa-aebb-83812257c098 ("Egg white")
-- Removing duplicate: "egg white" (7f016668-e6ba-47ce-8e83-ccde0376109a)
  UPDATE recipes SET ingredient_id = 'bd246b68-e854-4bfa-aebb-83812257c098' WHERE ingredient_id = '7f016668-e6ba-47ce-8e83-ccde0376109a';
  UPDATE recipes SET parent_ingredient_id = 'bd246b68-e854-4bfa-aebb-83812257c098' WHERE parent_ingredient_id = '7f016668-e6ba-47ce-8e83-ccde0376109a';
  UPDATE cocktails SET garnish_id = 'bd246b68-e854-4bfa-aebb-83812257c098' WHERE garnish_id = '7f016668-e6ba-47ce-8e83-ccde0376109a';
  DELETE FROM ingredients WHERE id = '7f016668-e6ba-47ce-8e83-ccde0376109a';

-- Merging duplicates for: "fernet branca" into canonical ID: 092acfa9-aa20-4ee6-a4da-89111a6e13ef ("Fernet branca")
-- Removing duplicate: "Fernet Branca" (d966fb4f-c521-4a6b-afdd-a683ddaac7df)
  UPDATE recipes SET ingredient_id = '092acfa9-aa20-4ee6-a4da-89111a6e13ef' WHERE ingredient_id = 'd966fb4f-c521-4a6b-afdd-a683ddaac7df';
  UPDATE recipes SET parent_ingredient_id = '092acfa9-aa20-4ee6-a4da-89111a6e13ef' WHERE parent_ingredient_id = 'd966fb4f-c521-4a6b-afdd-a683ddaac7df';
  UPDATE cocktails SET garnish_id = '092acfa9-aa20-4ee6-a4da-89111a6e13ef' WHERE garnish_id = 'd966fb4f-c521-4a6b-afdd-a683ddaac7df';
  DELETE FROM ingredients WHERE id = 'd966fb4f-c521-4a6b-afdd-a683ddaac7df';

-- Merging duplicates for: "fino sherry" into canonical ID: aa62c0bb-694f-4e0b-860f-eb6088f45944 ("Fino sherry")
-- Removing duplicate: "fino sherry" (20c5aec3-5494-4b27-b329-f6c52ed429ed)
  UPDATE recipes SET ingredient_id = 'aa62c0bb-694f-4e0b-860f-eb6088f45944' WHERE ingredient_id = '20c5aec3-5494-4b27-b329-f6c52ed429ed';
  UPDATE recipes SET parent_ingredient_id = 'aa62c0bb-694f-4e0b-860f-eb6088f45944' WHERE parent_ingredient_id = '20c5aec3-5494-4b27-b329-f6c52ed429ed';
  UPDATE cocktails SET garnish_id = 'aa62c0bb-694f-4e0b-860f-eb6088f45944' WHERE garnish_id = '20c5aec3-5494-4b27-b329-f6c52ed429ed';
  DELETE FROM ingredients WHERE id = '20c5aec3-5494-4b27-b329-f6c52ed429ed';

-- Merging duplicates for: "gin" into canonical ID: 32cb80d7-2af2-4684-8e81-293e9299b2a9 ("Gin")
-- Removing duplicate: "gin" (f4831fa8-9179-43af-955a-f5d701e1fc71)
  UPDATE recipes SET ingredient_id = '32cb80d7-2af2-4684-8e81-293e9299b2a9' WHERE ingredient_id = 'f4831fa8-9179-43af-955a-f5d701e1fc71';
  UPDATE recipes SET parent_ingredient_id = '32cb80d7-2af2-4684-8e81-293e9299b2a9' WHERE parent_ingredient_id = 'f4831fa8-9179-43af-955a-f5d701e1fc71';
  UPDATE cocktails SET garnish_id = '32cb80d7-2af2-4684-8e81-293e9299b2a9' WHERE garnish_id = 'f4831fa8-9179-43af-955a-f5d701e1fc71';
  DELETE FROM ingredients WHERE id = 'f4831fa8-9179-43af-955a-f5d701e1fc71';

-- Merging duplicates for: "honey syrup" into canonical ID: e3cc075a-00f6-47a7-8f09-003f3f19c3f4 ("Honey syrup")
-- Removing duplicate: "honey syrup" (53a58a3a-dd81-4a48-ad2c-e9b090341d2d)
  UPDATE recipes SET ingredient_id = 'e3cc075a-00f6-47a7-8f09-003f3f19c3f4' WHERE ingredient_id = '53a58a3a-dd81-4a48-ad2c-e9b090341d2d';
  UPDATE recipes SET parent_ingredient_id = 'e3cc075a-00f6-47a7-8f09-003f3f19c3f4' WHERE parent_ingredient_id = '53a58a3a-dd81-4a48-ad2c-e9b090341d2d';
  UPDATE cocktails SET garnish_id = 'e3cc075a-00f6-47a7-8f09-003f3f19c3f4' WHERE garnish_id = '53a58a3a-dd81-4a48-ad2c-e9b090341d2d';
  DELETE FROM ingredients WHERE id = '53a58a3a-dd81-4a48-ad2c-e9b090341d2d';

-- Merging duplicates for: "jamaican rum" into canonical ID: 821d12c4-7c84-49b9-861c-d593f14c8e6c ("Jamaican rum")
-- Removing duplicate: "Jamaican Rum" (cca5f794-c03f-4442-aee2-54e2e6729df1)
  UPDATE recipes SET ingredient_id = '821d12c4-7c84-49b9-861c-d593f14c8e6c' WHERE ingredient_id = 'cca5f794-c03f-4442-aee2-54e2e6729df1';
  UPDATE recipes SET parent_ingredient_id = '821d12c4-7c84-49b9-861c-d593f14c8e6c' WHERE parent_ingredient_id = 'cca5f794-c03f-4442-aee2-54e2e6729df1';
  UPDATE cocktails SET garnish_id = '821d12c4-7c84-49b9-861c-d593f14c8e6c' WHERE garnish_id = 'cca5f794-c03f-4442-aee2-54e2e6729df1';
  DELETE FROM ingredients WHERE id = 'cca5f794-c03f-4442-aee2-54e2e6729df1';

-- Merging duplicates for: "lemon" into canonical ID: 3cb61934-68cb-42b8-bf4b-99d18ccd6403 ("Lemon")
-- Removing duplicate: "lemon" (1954fe6b-893a-4082-9b83-a5f3927aa961)
  UPDATE recipes SET ingredient_id = '3cb61934-68cb-42b8-bf4b-99d18ccd6403' WHERE ingredient_id = '1954fe6b-893a-4082-9b83-a5f3927aa961';
  UPDATE recipes SET parent_ingredient_id = '3cb61934-68cb-42b8-bf4b-99d18ccd6403' WHERE parent_ingredient_id = '1954fe6b-893a-4082-9b83-a5f3927aa961';
  UPDATE cocktails SET garnish_id = '3cb61934-68cb-42b8-bf4b-99d18ccd6403' WHERE garnish_id = '1954fe6b-893a-4082-9b83-a5f3927aa961';
  DELETE FROM ingredients WHERE id = '1954fe6b-893a-4082-9b83-a5f3927aa961';

-- Merging duplicates for: "lemon juice" into canonical ID: 1dff8261-7d9c-4c41-a5e0-f60146333ef9 ("Lemon juice")
-- Removing duplicate: "lemon juice" (bb7de2f6-28c9-4ea5-b097-8cb372e49441)
  UPDATE recipes SET ingredient_id = '1dff8261-7d9c-4c41-a5e0-f60146333ef9' WHERE ingredient_id = 'bb7de2f6-28c9-4ea5-b097-8cb372e49441';
  UPDATE recipes SET parent_ingredient_id = '1dff8261-7d9c-4c41-a5e0-f60146333ef9' WHERE parent_ingredient_id = 'bb7de2f6-28c9-4ea5-b097-8cb372e49441';
  UPDATE cocktails SET garnish_id = '1dff8261-7d9c-4c41-a5e0-f60146333ef9' WHERE garnish_id = 'bb7de2f6-28c9-4ea5-b097-8cb372e49441';
  DELETE FROM ingredients WHERE id = 'bb7de2f6-28c9-4ea5-b097-8cb372e49441';
-- Removing duplicate: "Lemon Juice" (c3bdc318-609b-4c98-9080-12dea6c622fe)
  UPDATE recipes SET ingredient_id = '1dff8261-7d9c-4c41-a5e0-f60146333ef9' WHERE ingredient_id = 'c3bdc318-609b-4c98-9080-12dea6c622fe';
  UPDATE recipes SET parent_ingredient_id = '1dff8261-7d9c-4c41-a5e0-f60146333ef9' WHERE parent_ingredient_id = 'c3bdc318-609b-4c98-9080-12dea6c622fe';
  UPDATE cocktails SET garnish_id = '1dff8261-7d9c-4c41-a5e0-f60146333ef9' WHERE garnish_id = 'c3bdc318-609b-4c98-9080-12dea6c622fe';
  DELETE FROM ingredients WHERE id = 'c3bdc318-609b-4c98-9080-12dea6c622fe';

-- Merging duplicates for: "lillet" into canonical ID: aa21e0ac-1cd5-4144-99a7-6187c6431412 ("Lillet")
-- Removing duplicate: "lillet" (6828c6a3-800a-4291-9832-f35026ad20d8)
  UPDATE recipes SET ingredient_id = 'aa21e0ac-1cd5-4144-99a7-6187c6431412' WHERE ingredient_id = '6828c6a3-800a-4291-9832-f35026ad20d8';
  UPDATE recipes SET parent_ingredient_id = 'aa21e0ac-1cd5-4144-99a7-6187c6431412' WHERE parent_ingredient_id = '6828c6a3-800a-4291-9832-f35026ad20d8';
  UPDATE cocktails SET garnish_id = 'aa21e0ac-1cd5-4144-99a7-6187c6431412' WHERE garnish_id = '6828c6a3-800a-4291-9832-f35026ad20d8';
  DELETE FROM ingredients WHERE id = '6828c6a3-800a-4291-9832-f35026ad20d8';

-- Merging duplicates for: "lime" into canonical ID: 98078c5d-b1cd-4c1b-bf62-c71c6f1016a6 ("Lime")
-- Removing duplicate: "lime" (4487d872-8601-4606-8e8b-5eb0a56b14a7)
  UPDATE recipes SET ingredient_id = '98078c5d-b1cd-4c1b-bf62-c71c6f1016a6' WHERE ingredient_id = '4487d872-8601-4606-8e8b-5eb0a56b14a7';
  UPDATE recipes SET parent_ingredient_id = '98078c5d-b1cd-4c1b-bf62-c71c6f1016a6' WHERE parent_ingredient_id = '4487d872-8601-4606-8e8b-5eb0a56b14a7';
  UPDATE cocktails SET garnish_id = '98078c5d-b1cd-4c1b-bf62-c71c6f1016a6' WHERE garnish_id = '4487d872-8601-4606-8e8b-5eb0a56b14a7';
  DELETE FROM ingredients WHERE id = '4487d872-8601-4606-8e8b-5eb0a56b14a7';

-- Merging duplicates for: "lime juice" into canonical ID: 237f18ec-1aeb-42ef-9d67-4d0937d6787a ("Lime juice")
-- Removing duplicate: "lime juice" (961f1174-8a7e-4f73-afb9-3326724cbe78)
  UPDATE recipes SET ingredient_id = '237f18ec-1aeb-42ef-9d67-4d0937d6787a' WHERE ingredient_id = '961f1174-8a7e-4f73-afb9-3326724cbe78';
  UPDATE recipes SET parent_ingredient_id = '237f18ec-1aeb-42ef-9d67-4d0937d6787a' WHERE parent_ingredient_id = '961f1174-8a7e-4f73-afb9-3326724cbe78';
  UPDATE cocktails SET garnish_id = '237f18ec-1aeb-42ef-9d67-4d0937d6787a' WHERE garnish_id = '961f1174-8a7e-4f73-afb9-3326724cbe78';
  DELETE FROM ingredients WHERE id = '961f1174-8a7e-4f73-afb9-3326724cbe78';
-- Removing duplicate: "Lime Juice" (0174047d-c4a7-4167-9c04-a293e97d0453)
  UPDATE recipes SET ingredient_id = '237f18ec-1aeb-42ef-9d67-4d0937d6787a' WHERE ingredient_id = '0174047d-c4a7-4167-9c04-a293e97d0453';
  UPDATE recipes SET parent_ingredient_id = '237f18ec-1aeb-42ef-9d67-4d0937d6787a' WHERE parent_ingredient_id = '0174047d-c4a7-4167-9c04-a293e97d0453';
  UPDATE cocktails SET garnish_id = '237f18ec-1aeb-42ef-9d67-4d0937d6787a' WHERE garnish_id = '0174047d-c4a7-4167-9c04-a293e97d0453';
  DELETE FROM ingredients WHERE id = '0174047d-c4a7-4167-9c04-a293e97d0453';

-- Merging duplicates for: "marachino" into canonical ID: 022b2d29-c504-4348-bd25-f9f95d172499 ("Marachino")
-- Removing duplicate: "marachino" (7de56de0-c8b3-49c7-8eee-fcba568bc9c7)
  UPDATE recipes SET ingredient_id = '022b2d29-c504-4348-bd25-f9f95d172499' WHERE ingredient_id = '7de56de0-c8b3-49c7-8eee-fcba568bc9c7';
  UPDATE recipes SET parent_ingredient_id = '022b2d29-c504-4348-bd25-f9f95d172499' WHERE parent_ingredient_id = '7de56de0-c8b3-49c7-8eee-fcba568bc9c7';
  UPDATE cocktails SET garnish_id = '022b2d29-c504-4348-bd25-f9f95d172499' WHERE garnish_id = '7de56de0-c8b3-49c7-8eee-fcba568bc9c7';
  DELETE FROM ingredients WHERE id = '7de56de0-c8b3-49c7-8eee-fcba568bc9c7';

-- Merging duplicates for: "maraschino" into canonical ID: d00b13d0-0bcf-411f-af6d-3084f912bdca ("Maraschino")
-- Removing duplicate: "maraschino" (af89121c-f15a-4f21-846f-81a655197154)
  UPDATE recipes SET ingredient_id = 'd00b13d0-0bcf-411f-af6d-3084f912bdca' WHERE ingredient_id = 'af89121c-f15a-4f21-846f-81a655197154';
  UPDATE recipes SET parent_ingredient_id = 'd00b13d0-0bcf-411f-af6d-3084f912bdca' WHERE parent_ingredient_id = 'af89121c-f15a-4f21-846f-81a655197154';
  UPDATE cocktails SET garnish_id = 'd00b13d0-0bcf-411f-af6d-3084f912bdca' WHERE garnish_id = 'af89121c-f15a-4f21-846f-81a655197154';
  DELETE FROM ingredients WHERE id = 'af89121c-f15a-4f21-846f-81a655197154';

-- Merging duplicates for: "michters rye" into canonical ID: 8372a107-e947-4002-84c6-b4bcab255358 ("Michters rye")
-- Removing duplicate: "Michters Rye" (9d7698b7-2440-4342-8838-88e19c9ef349)
  UPDATE recipes SET ingredient_id = '8372a107-e947-4002-84c6-b4bcab255358' WHERE ingredient_id = '9d7698b7-2440-4342-8838-88e19c9ef349';
  UPDATE recipes SET parent_ingredient_id = '8372a107-e947-4002-84c6-b4bcab255358' WHERE parent_ingredient_id = '9d7698b7-2440-4342-8838-88e19c9ef349';
  UPDATE cocktails SET garnish_id = '8372a107-e947-4002-84c6-b4bcab255358' WHERE garnish_id = '9d7698b7-2440-4342-8838-88e19c9ef349';
  DELETE FROM ingredients WHERE id = '9d7698b7-2440-4342-8838-88e19c9ef349';

-- Merging duplicates for: "orange" into canonical ID: a6da83cf-3f27-41e7-aa7b-f7391171e6c1 ("Orange")
-- Removing duplicate: "orange" (b4e89387-813f-4a83-8120-26da94aad035)
  UPDATE recipes SET ingredient_id = 'a6da83cf-3f27-41e7-aa7b-f7391171e6c1' WHERE ingredient_id = 'b4e89387-813f-4a83-8120-26da94aad035';
  UPDATE recipes SET parent_ingredient_id = 'a6da83cf-3f27-41e7-aa7b-f7391171e6c1' WHERE parent_ingredient_id = 'b4e89387-813f-4a83-8120-26da94aad035';
  UPDATE cocktails SET garnish_id = 'a6da83cf-3f27-41e7-aa7b-f7391171e6c1' WHERE garnish_id = 'b4e89387-813f-4a83-8120-26da94aad035';
  DELETE FROM ingredients WHERE id = 'b4e89387-813f-4a83-8120-26da94aad035';

-- Merging duplicates for: "orange bitters" into canonical ID: 21419570-13b0-49bf-9463-5bf548b91113 ("Orange bitters")
-- Removing duplicate: "orange bitters" (e2a66626-1be6-414c-bc45-a2c98c73c5a7)
  UPDATE recipes SET ingredient_id = '21419570-13b0-49bf-9463-5bf548b91113' WHERE ingredient_id = 'e2a66626-1be6-414c-bc45-a2c98c73c5a7';
  UPDATE recipes SET parent_ingredient_id = '21419570-13b0-49bf-9463-5bf548b91113' WHERE parent_ingredient_id = 'e2a66626-1be6-414c-bc45-a2c98c73c5a7';
  UPDATE cocktails SET garnish_id = '21419570-13b0-49bf-9463-5bf548b91113' WHERE garnish_id = 'e2a66626-1be6-414c-bc45-a2c98c73c5a7';
  DELETE FROM ingredients WHERE id = 'e2a66626-1be6-414c-bc45-a2c98c73c5a7';
-- Removing duplicate: "orange Bitters" (7d2eff1a-73d7-452d-a5a6-6687423e2d43)
  UPDATE recipes SET ingredient_id = '21419570-13b0-49bf-9463-5bf548b91113' WHERE ingredient_id = '7d2eff1a-73d7-452d-a5a6-6687423e2d43';
  UPDATE recipes SET parent_ingredient_id = '21419570-13b0-49bf-9463-5bf548b91113' WHERE parent_ingredient_id = '7d2eff1a-73d7-452d-a5a6-6687423e2d43';
  UPDATE cocktails SET garnish_id = '21419570-13b0-49bf-9463-5bf548b91113' WHERE garnish_id = '7d2eff1a-73d7-452d-a5a6-6687423e2d43';
  DELETE FROM ingredients WHERE id = '7d2eff1a-73d7-452d-a5a6-6687423e2d43';

-- Merging duplicates for: "pey" into canonical ID: c6b32411-d90c-4b03-a619-bd817cfca3cf ("Pey")
-- Removing duplicate: "pey" (58ff3437-5586-49d3-ae4d-5ee5fd8aee24)
  UPDATE recipes SET ingredient_id = 'c6b32411-d90c-4b03-a619-bd817cfca3cf' WHERE ingredient_id = '58ff3437-5586-49d3-ae4d-5ee5fd8aee24';
  UPDATE recipes SET parent_ingredient_id = 'c6b32411-d90c-4b03-a619-bd817cfca3cf' WHERE parent_ingredient_id = '58ff3437-5586-49d3-ae4d-5ee5fd8aee24';
  UPDATE cocktails SET garnish_id = 'c6b32411-d90c-4b03-a619-bd817cfca3cf' WHERE garnish_id = '58ff3437-5586-49d3-ae4d-5ee5fd8aee24';
  DELETE FROM ingredients WHERE id = '58ff3437-5586-49d3-ae4d-5ee5fd8aee24';

-- Merging duplicates for: "peychauds" into canonical ID: ba2710ba-352c-4ec5-badf-3b4bf40481a8 ("Peychauds")
-- Removing duplicate: "peychauds" (35e8a97d-6e2e-4cbd-84d7-ee710f8b0168)
  UPDATE recipes SET ingredient_id = 'ba2710ba-352c-4ec5-badf-3b4bf40481a8' WHERE ingredient_id = '35e8a97d-6e2e-4cbd-84d7-ee710f8b0168';
  UPDATE recipes SET parent_ingredient_id = 'ba2710ba-352c-4ec5-badf-3b4bf40481a8' WHERE parent_ingredient_id = '35e8a97d-6e2e-4cbd-84d7-ee710f8b0168';
  UPDATE cocktails SET garnish_id = 'ba2710ba-352c-4ec5-badf-3b4bf40481a8' WHERE garnish_id = '35e8a97d-6e2e-4cbd-84d7-ee710f8b0168';
  DELETE FROM ingredients WHERE id = '35e8a97d-6e2e-4cbd-84d7-ee710f8b0168';

-- Merging duplicates for: "punt e mes" into canonical ID: 8dc6b24a-076b-4e1a-b6dd-42b7809495b0 ("Punt e Mes")
-- Removing duplicate: "Punt E Mes" (ce45e081-77b7-4204-a4a9-d7af5090071a)
  UPDATE recipes SET ingredient_id = '8dc6b24a-076b-4e1a-b6dd-42b7809495b0' WHERE ingredient_id = 'ce45e081-77b7-4204-a4a9-d7af5090071a';
  UPDATE recipes SET parent_ingredient_id = '8dc6b24a-076b-4e1a-b6dd-42b7809495b0' WHERE parent_ingredient_id = 'ce45e081-77b7-4204-a4a9-d7af5090071a';
  UPDATE cocktails SET garnish_id = '8dc6b24a-076b-4e1a-b6dd-42b7809495b0' WHERE garnish_id = 'ce45e081-77b7-4204-a4a9-d7af5090071a';
  DELETE FROM ingredients WHERE id = 'ce45e081-77b7-4204-a4a9-d7af5090071a';

-- Merging duplicates for: "ruby port" into canonical ID: f31ca173-fca8-4912-94db-cd927e68896c ("Ruby port")
-- Removing duplicate: "ruby port" (a740a184-f35c-4600-9ed2-ca2451531eb2)
  UPDATE recipes SET ingredient_id = 'f31ca173-fca8-4912-94db-cd927e68896c' WHERE ingredient_id = 'a740a184-f35c-4600-9ed2-ca2451531eb2';
  UPDATE recipes SET parent_ingredient_id = 'f31ca173-fca8-4912-94db-cd927e68896c' WHERE parent_ingredient_id = 'a740a184-f35c-4600-9ed2-ca2451531eb2';
  UPDATE cocktails SET garnish_id = 'f31ca173-fca8-4912-94db-cd927e68896c' WHERE garnish_id = 'a740a184-f35c-4600-9ed2-ca2451531eb2';
  DELETE FROM ingredients WHERE id = 'a740a184-f35c-4600-9ed2-ca2451531eb2';

-- Merging duplicates for: "rye" into canonical ID: bfffc412-71c1-4dcf-83cb-19729951dfe9 ("Rye")
-- Removing duplicate: "rye" (b1f31c6f-b128-46cc-8e9f-c5f458552189)
  UPDATE recipes SET ingredient_id = 'bfffc412-71c1-4dcf-83cb-19729951dfe9' WHERE ingredient_id = 'b1f31c6f-b128-46cc-8e9f-c5f458552189';
  UPDATE recipes SET parent_ingredient_id = 'bfffc412-71c1-4dcf-83cb-19729951dfe9' WHERE parent_ingredient_id = 'b1f31c6f-b128-46cc-8e9f-c5f458552189';
  UPDATE cocktails SET garnish_id = 'bfffc412-71c1-4dcf-83cb-19729951dfe9' WHERE garnish_id = 'b1f31c6f-b128-46cc-8e9f-c5f458552189';
  DELETE FROM ingredients WHERE id = 'b1f31c6f-b128-46cc-8e9f-c5f458552189';

-- Merging duplicates for: "scotch" into canonical ID: 1114efed-3fdd-4233-a5e2-37febddda7bb ("Scotch")
-- Removing duplicate: "scotch" (1313b106-77d9-46fb-bb50-f6199333c0d7)
  UPDATE recipes SET ingredient_id = '1114efed-3fdd-4233-a5e2-37febddda7bb' WHERE ingredient_id = '1313b106-77d9-46fb-bb50-f6199333c0d7';
  UPDATE recipes SET parent_ingredient_id = '1114efed-3fdd-4233-a5e2-37febddda7bb' WHERE parent_ingredient_id = '1313b106-77d9-46fb-bb50-f6199333c0d7';
  UPDATE cocktails SET garnish_id = '1114efed-3fdd-4233-a5e2-37febddda7bb' WHERE garnish_id = '1313b106-77d9-46fb-bb50-f6199333c0d7';
  DELETE FROM ingredients WHERE id = '1313b106-77d9-46fb-bb50-f6199333c0d7';

-- Merging duplicates for: "soda" into canonical ID: c097eb00-d3f1-4049-863b-0dc80d81b40e ("Soda")
-- Removing duplicate: "soda" (f6958d91-3711-4b9f-a660-3736d308cbdc)
  UPDATE recipes SET ingredient_id = 'c097eb00-d3f1-4049-863b-0dc80d81b40e' WHERE ingredient_id = 'f6958d91-3711-4b9f-a660-3736d308cbdc';
  UPDATE recipes SET parent_ingredient_id = 'c097eb00-d3f1-4049-863b-0dc80d81b40e' WHERE parent_ingredient_id = 'f6958d91-3711-4b9f-a660-3736d308cbdc';
  UPDATE cocktails SET garnish_id = 'c097eb00-d3f1-4049-863b-0dc80d81b40e' WHERE garnish_id = 'f6958d91-3711-4b9f-a660-3736d308cbdc';
  DELETE FROM ingredients WHERE id = 'f6958d91-3711-4b9f-a660-3736d308cbdc';

-- Merging duplicates for: "sugar" into canonical ID: 3a43b3d1-afc0-4dd4-8095-2d724c5558f4 ("Sugar")
-- Removing duplicate: "sugar" (a9edf9e1-19f9-41f4-9ab3-4f75fd095bcb)
  UPDATE recipes SET ingredient_id = '3a43b3d1-afc0-4dd4-8095-2d724c5558f4' WHERE ingredient_id = 'a9edf9e1-19f9-41f4-9ab3-4f75fd095bcb';
  UPDATE recipes SET parent_ingredient_id = '3a43b3d1-afc0-4dd4-8095-2d724c5558f4' WHERE parent_ingredient_id = 'a9edf9e1-19f9-41f4-9ab3-4f75fd095bcb';
  UPDATE cocktails SET garnish_id = '3a43b3d1-afc0-4dd4-8095-2d724c5558f4' WHERE garnish_id = 'a9edf9e1-19f9-41f4-9ab3-4f75fd095bcb';
  DELETE FROM ingredients WHERE id = 'a9edf9e1-19f9-41f4-9ab3-4f75fd095bcb';

-- Merging duplicates for: "sweet vermouth" into canonical ID: f007f252-0204-46a1-8f1e-6c4e04788ada ("Sweet vermouth")
-- Removing duplicate: "sweet vermouth" (050ce743-6abd-4ac6-8342-eb38e9ff6d74)
  UPDATE recipes SET ingredient_id = 'f007f252-0204-46a1-8f1e-6c4e04788ada' WHERE ingredient_id = '050ce743-6abd-4ac6-8342-eb38e9ff6d74';
  UPDATE recipes SET parent_ingredient_id = 'f007f252-0204-46a1-8f1e-6c4e04788ada' WHERE parent_ingredient_id = '050ce743-6abd-4ac6-8342-eb38e9ff6d74';
  UPDATE cocktails SET garnish_id = 'f007f252-0204-46a1-8f1e-6c4e04788ada' WHERE garnish_id = '050ce743-6abd-4ac6-8342-eb38e9ff6d74';
  DELETE FROM ingredients WHERE id = '050ce743-6abd-4ac6-8342-eb38e9ff6d74';
-- Removing duplicate: "Sweet Vermouth" (a018d16c-2d3b-4f2a-b437-2b6543f5adfc)
  UPDATE recipes SET ingredient_id = 'f007f252-0204-46a1-8f1e-6c4e04788ada' WHERE ingredient_id = 'a018d16c-2d3b-4f2a-b437-2b6543f5adfc';
  UPDATE recipes SET parent_ingredient_id = 'f007f252-0204-46a1-8f1e-6c4e04788ada' WHERE parent_ingredient_id = 'a018d16c-2d3b-4f2a-b437-2b6543f5adfc';
  UPDATE cocktails SET garnish_id = 'f007f252-0204-46a1-8f1e-6c4e04788ada' WHERE garnish_id = 'a018d16c-2d3b-4f2a-b437-2b6543f5adfc';
  DELETE FROM ingredients WHERE id = 'a018d16c-2d3b-4f2a-b437-2b6543f5adfc';

-- Merging duplicates for: "tequila" into canonical ID: 9a1d0b18-5fe5-47f6-827b-e8e77369f6ff ("Tequila")
-- Removing duplicate: "tequila" (64cefc30-a812-4504-94bb-b4d5b9b12b48)
  UPDATE recipes SET ingredient_id = '9a1d0b18-5fe5-47f6-827b-e8e77369f6ff' WHERE ingredient_id = '64cefc30-a812-4504-94bb-b4d5b9b12b48';
  UPDATE recipes SET parent_ingredient_id = '9a1d0b18-5fe5-47f6-827b-e8e77369f6ff' WHERE parent_ingredient_id = '64cefc30-a812-4504-94bb-b4d5b9b12b48';
  UPDATE cocktails SET garnish_id = '9a1d0b18-5fe5-47f6-827b-e8e77369f6ff' WHERE garnish_id = '64cefc30-a812-4504-94bb-b4d5b9b12b48';
  DELETE FROM ingredients WHERE id = '64cefc30-a812-4504-94bb-b4d5b9b12b48';

-- Merging duplicates for: "top soda" into canonical ID: 9c864774-ba46-4b78-8da7-ccc0e9ca9f5a ("Top soda")
-- Removing duplicate: "top soda" (7d5878ea-36d4-4aa4-851c-48c3cc38b787)
  UPDATE recipes SET ingredient_id = '9c864774-ba46-4b78-8da7-ccc0e9ca9f5a' WHERE ingredient_id = '7d5878ea-36d4-4aa4-851c-48c3cc38b787';
  UPDATE recipes SET parent_ingredient_id = '9c864774-ba46-4b78-8da7-ccc0e9ca9f5a' WHERE parent_ingredient_id = '7d5878ea-36d4-4aa4-851c-48c3cc38b787';
  UPDATE cocktails SET garnish_id = '9c864774-ba46-4b78-8da7-ccc0e9ca9f5a' WHERE garnish_id = '7d5878ea-36d4-4aa4-851c-48c3cc38b787';
  DELETE FROM ingredients WHERE id = '7d5878ea-36d4-4aa4-851c-48c3cc38b787';

-- Merging duplicates for: "vodka" into canonical ID: 6c1e327c-c61c-479d-b0b9-e802901d6aa7 ("Vodka")
-- Removing duplicate: "vodka" (9c439f2c-e4c2-42ab-972e-35a527ffb386)
  UPDATE recipes SET ingredient_id = '6c1e327c-c61c-479d-b0b9-e802901d6aa7' WHERE ingredient_id = '9c439f2c-e4c2-42ab-972e-35a527ffb386';
  UPDATE recipes SET parent_ingredient_id = '6c1e327c-c61c-479d-b0b9-e802901d6aa7' WHERE parent_ingredient_id = '9c439f2c-e4c2-42ab-972e-35a527ffb386';
  UPDATE cocktails SET garnish_id = '6c1e327c-c61c-479d-b0b9-e802901d6aa7' WHERE garnish_id = '9c439f2c-e4c2-42ab-972e-35a527ffb386';
  DELETE FROM ingredients WHERE id = '9c439f2c-e4c2-42ab-972e-35a527ffb386';

-- Merging duplicates for: "white rum" into canonical ID: 06303e69-4270-4ec5-9bd6-a25f686b5a45 ("White rum")
-- Removing duplicate: "white rum" (8080ab11-2371-4f0c-b0ae-1196198cf018)
  UPDATE recipes SET ingredient_id = '06303e69-4270-4ec5-9bd6-a25f686b5a45' WHERE ingredient_id = '8080ab11-2371-4f0c-b0ae-1196198cf018';
  UPDATE recipes SET parent_ingredient_id = '06303e69-4270-4ec5-9bd6-a25f686b5a45' WHERE parent_ingredient_id = '8080ab11-2371-4f0c-b0ae-1196198cf018';
  UPDATE cocktails SET garnish_id = '06303e69-4270-4ec5-9bd6-a25f686b5a45' WHERE garnish_id = '8080ab11-2371-4f0c-b0ae-1196198cf018';
  DELETE FROM ingredients WHERE id = '8080ab11-2371-4f0c-b0ae-1196198cf018';
-- Removing duplicate: "White Rum" (1d39b660-63c4-4272-9b60-fb703d30ade0)
  UPDATE recipes SET ingredient_id = '06303e69-4270-4ec5-9bd6-a25f686b5a45' WHERE ingredient_id = '1d39b660-63c4-4272-9b60-fb703d30ade0';
  UPDATE recipes SET parent_ingredient_id = '06303e69-4270-4ec5-9bd6-a25f686b5a45' WHERE parent_ingredient_id = '1d39b660-63c4-4272-9b60-fb703d30ade0';
  UPDATE cocktails SET garnish_id = '06303e69-4270-4ec5-9bd6-a25f686b5a45' WHERE garnish_id = '1d39b660-63c4-4272-9b60-fb703d30ade0';
  DELETE FROM ingredients WHERE id = '1d39b660-63c4-4272-9b60-fb703d30ade0';

-- Merging duplicates for: "yellow chartreuse" into canonical ID: 7f211ef9-bf7f-4eb8-af86-95a061b06f9f ("Yellow Chartreuse")
-- Removing duplicate: "yellow chartreuse" (30385ed3-8290-4b3b-b6f3-ad1fdce8a8ea)
  UPDATE recipes SET ingredient_id = '7f211ef9-bf7f-4eb8-af86-95a061b06f9f' WHERE ingredient_id = '30385ed3-8290-4b3b-b6f3-ad1fdce8a8ea';
  UPDATE recipes SET parent_ingredient_id = '7f211ef9-bf7f-4eb8-af86-95a061b06f9f' WHERE parent_ingredient_id = '30385ed3-8290-4b3b-b6f3-ad1fdce8a8ea';
  UPDATE cocktails SET garnish_id = '7f211ef9-bf7f-4eb8-af86-95a061b06f9f' WHERE garnish_id = '30385ed3-8290-4b3b-b6f3-ad1fdce8a8ea';
  DELETE FROM ingredients WHERE id = '30385ed3-8290-4b3b-b6f3-ad1fdce8a8ea';

COMMIT;
