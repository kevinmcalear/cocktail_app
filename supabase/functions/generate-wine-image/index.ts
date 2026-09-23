import { HOUSE_STYLE, serveItemImageGenerator } from "../_shared/itemImage.ts";

serveItemImageGenerator({
  name: "generate-wine-image",
  idField: "wine_id",
  itemType: "wine",
  folder: "wines",
  buildPrompt: (wine) => {
    const details = [
      wine.origin ? `from ${wine.origin}` : "",
      wine.abv ? `${wine.abv}% ABV` : "",
    ].filter(Boolean);

    return (
      `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist wine: ${wine.name}. ` +
      `${details.length ? details.join(", ") : "Fine wine"}. ` +
      `PERFECT professional pour, served in an elegant appropriate wine glass. ` +
      `The liquid must look very specific to its style/color. ${HOUSE_STYLE}`
    );
  },
});
