import { serveItemImageGenerator } from "../_shared/itemImage.ts";

serveItemImageGenerator({ name: "generate-ingredient-image", idField: "ingredient_id", itemType: "ingredient" });
