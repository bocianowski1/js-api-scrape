const PORT = process.env.PORT || 8000;
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
// const path = require("path"); // Serve static files from the React frontend app

const app = express();
// app.use(express.static(path.join(__dirname, "frontend/"))); // Anything that doesn't match the above, send back index.html
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname + "./../frontend/pages/_app.tsx"));
// });

// CORS STUFF
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const getAttributes = (string) => {
  const space = /&nbsp;/g;
  string = string.replace(space, "");
  let numbers = string.match(/\d+/g);

  try {
    const squareMeters = parseInt(numbers[0]);
    const monthlyRent = parseInt(numbers[1]);
    return { squareMeters, monthlyRent };
  } catch {
    (err) => console.log(err);
  }
};

const splitInfo = (string) => {
  const containsNumbers = string.match(/\d+/g);
  let bedrooms = containsNumbers ? containsNumbers[0] : 0;
  const housingType = string.split(/\s/g)[0];

  return { bedrooms, housingType };
};

const areas = {
  oslo: "0.20061",
  viken: "0.22030",
  bergen: "1.22046.20220",
  trondheim: "1.20016.20318",
};

// number of pages to scrape
const N = 3;

// SCRAPING
const getRealEstate = (n, location) => {
  const pages = [];
  for (let i = 0; i < n; i++) {
    let url = location
      ? `https://www.finn.no/realestate/lettings/search.html?location=${location}&page=${
          i + 1
        }&sort=PUBLISHED_DESC`
      : `https://www.finn.no/realestate/lettings/search.html?page=${
          i + 1
        }&sort=PUBLISHED_DESC`;

    const ads = [];

    axios.get(url).then((response) => {
      const html = response.data;
      const $ = cheerio.load(html);

      $(
        'article[class="relative overflow-hidden transition-all outline-none sf-ad-outline sf-ad-card rounded-8 mt-24 mx-16 mb-16 sm:mb-24 relative grid f-grid grid-cols-2"]'
      ).each(function () {
        const atag = $(this).find(
          'a[class="link link--dark sf-ad-link sf-realestate-heading"]'
        );
        const id = parseInt(atag.attr("id"));
        const title = atag.text();
        let features = $(this)
          .find(
            'div[class="col-span-2 mt-16 sm:mt-4 flex justify-between sm:block space-x-12 font-bold"]'
          )
          .html();

        features = getAttributes(features);
        const link = atag.attr("href");
        const address = $(this)
          .find(
            'div[class="sm:order-first sm:text-right mt-4 sm:mt-0 sm:ml-16 sf-line-clamp-2 sf-realestate-location"]'
          )
          .text();

        let city = address.split(" ");
        city = city[city.length - 1];

        const location = { address, city };

        const info = $(this)
          .find(
            'div[class="mt-4 sm:mt-8 text-12 text-gray-500 flex flex-col sm:block"]'
          )
          .text();

        const housingType = splitInfo(info)["housingType"];
        const bedrooms = parseInt(splitInfo(info)["bedrooms"]);

        const landlord = $(this)
          .find(
            'div[class="col-span-2 sm:col-span-1 sm:order-first sm:flex sm:items-center"]'
          )
          .text();

        const images = [];
        $(this)
          .find('img[class="w-full h-full object-center object-cover "]')
          .each(function () {
            const image = $(this).attr("src");
            images.push(image);
          });

        ads.push({
          id,
          title,
          features,
          link,
          location,
          housingType,
          bedrooms,
          landlord,
          images,
        });
      });
    });

    pages.push({ ads });
  }
  return pages;
};

const flattenResult = (list) => {
  const res = [];
  for (let i = 0; i < list.length; i++) {
    const curr = list[i].ads;
    for (let j = 0; j < curr.length; j++) {
      res.push(curr[j]);
    }
  }
  return res;
};

// // MAJOR CITIES / AREAS
for (const area in areas) {
  const temp = getRealEstate(N, areas[area]);
  app.get(`/${area}`, (req, res) => {
    const result = flattenResult(temp).slice(1);
    res.json({ len: result.length, area, result });
  });
}

// INDEX
const pages = getRealEstate(N);
app.get("/", (req, res) => {
  const result = flattenResult(pages);
  res.json({ len: result.length, result });
});

app.get("/:id", async (req, res) => {
  const result = flattenResult(pages);
  const id = req.params.id;

  const correctAd = result.filter((ad) => ad.id == id);

  res.json({ ad: correctAd });
});

// console.log("Number of Pages: ", pages.length);
app.listen(PORT, () => console.log(`Running on PORT ${PORT}`));
