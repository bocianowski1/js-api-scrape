const PORT = 8000;
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

const getAttributes = (string) => {
  const space = /&nbsp;/g;
  string = string.replace(space, "");
  let numbers = string.match(/\d+/g);

  if (numbers.length > 2) {
    console.log(numbers);
  }

  const squareMeters = parseInt(numbers[0]);
  const monthlyRent = parseInt(numbers[1]);

  return { squareMeters, monthlyRent };
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

    pages.push(ads);
  }
  return pages;
};

// MAJOR CITIES / AREAS
for (const area in areas) {
  const pages = getRealEstate(N, areas[area]);
  app.get(`/${area}`, (req, res) => {
    res.json(pages);
  });
}

// INDEX
const pages = getRealEstate(N);

app.get("/", (req, res) => {
  res.json(pages);
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
