import { HOUSE_STYLE, serveItemImageGenerator } from "../_shared/itemImage.ts";

serveItemImageGenerator({
  name: "generate-beer-image",
  idField: "beer_id",
  itemType: "beer",
  folder: "beers",
  buildPrompt: (beer) => {
    const details = [
      beer.brand_maker ? `by ${beer.brand_maker}` : "",
      beer.abv ? `${beer.abv}% ABV` : "",
    ].filter(Boolean);

    return (
      `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist craft beer: ${beer.name}. ` +
      `${details.length ? details.join(", ") : "Craft beer"}. ` +
      `PERFECT professional pour, served in an elegant appropriate beer glass for the style. ` +
      `The liquid must look very authentic and refreshing. ${HOUSE_STYLE}`
    );
  },
});
