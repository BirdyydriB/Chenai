const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setArtoo,
  setLevenshteinFunction
} = require('./../scraper.js');

const phoneVendorUrl = 'https://www.recommerce.com/fr/';

/**
 * Main function to scrap recommerce
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('recommerce START');
    // Goto easycash, waiting page to be fully loaded
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto(phoneVendorUrl, {
        timeout: 0
      })
    ]);

    await page.waitFor(Math.random() * 500 + 200);
    await search(page, phone, phoneSearchConstraint);

    await page.waitFor(Math.random() * 500 + 200);
    await getPhoneFromSearch(page, phone);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page);

    console.log('recommerce END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on recommerce
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  // Focus searchField and make user search
  phoneSearchConstraint.withQuotes = false;
  // For some reason, in some rare cases (ex : iphone 7), brand in search lead to NO_RESULT_FOUND. As it seems putting/remooving brand does not change results for normal cases, don't use it.
  phoneSearchConstraint.withBrand = false;
  const phoneSearch = phone.toString(phoneSearchConstraint);
  console.log('recommerce search ', phoneSearch);
  await page.bringToFront();
  await page.focus('#search');
  await page.keyboard.type(phoneSearch, {
    delay: 100
  });
  await page.waitFor(Math.random() * 100 + 50);
  await page.bringToFront();
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('#search_mini_form > div.search-field button.button-search', {
      delay: Math.random() * 200 + 50
    }),
  ]);

  // Check if easycash found a phone
  await page.bringToFront();
  const hasResults = (await page.$('.category-noproducts') == null);
  if (!hasResults) {
    throw new Error(ScrapErrors.NO_RESULT_FOUND);
  }
}

/**
 * Find the phone in recommerce search result
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function getPhoneFromSearch(page, phone) {
  console.log('recommerce select in result list');
  // Check if recommerce found only one product (and already open detailed page), or a list of products
  if (page.url().indexOf('catalogsearch') != -1) {
    await page.waitForSelector('div.products-grid > div.row', {
      timeout: 0
    });
    await page.bringToFront();

    // Find result in list with minimum levenshtein distance
    await setLevenshteinFunction(page);

    var phoneSearch = phone.toString({ withQuotes: false, withColor: false });
    phoneSearch = (phoneSearch + ' ' + phone.color).toUpperCase(); // Recommerce put color after capacity... do the same
    const minimumLevenshteinLink = await page.evaluate((phoneSearch) => {
      var minimumLevenshtein = 999;
      var minimumLevenshteinLink = '';

      document.querySelectorAll('.product-item > a').forEach((a) => {
        const label = a.getAttribute('title').toUpperCase();
        const levenshtein = levenshteinDistance(label, phoneSearch);

        if (levenshtein < minimumLevenshtein) {
          minimumLevenshtein = levenshtein;
          minimumLevenshteinLink =  a.getAttribute('href');
        }
      });

      return minimumLevenshteinLink;
    }, phoneSearch);

    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto(minimumLevenshteinLink, {
        delay: Math.random() * 200 + 50,
        timeout: 0
      })
    ]);
  }
}

/**
 * Parse recommerce result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('recommerce parse result');
  await setArtoo(page);
  await page.bringToFront();

  var parsedDatas = await page.evaluate((conditionToGrade, gradeToCRCondition) => {
    var prices = artoo.scrape('div.product-options li.product-option-swatch > ul > li', {
      condition: function() {
        return artoo.$(this).find('.swatch-label').text().trim();
      },
      isPromo: () => false,
      price: function() {
        var priceStr = artoo.$(this).find('.swatch-price').text();
        return parseFloat(priceStr.slice(0, priceStr.indexOf('&'))
          .replace(',', '.')
          .trim());
      },
      available: function() {
        return !artoo.$(this).hasClass('disabled');
      }
    })
    .map((priceInfo) => {
      if ( !conditionToGrade.hasOwnProperty(priceInfo.condition) ) {
        // Something wrong in config : missing category keyWordCategories[keyWord]
        priceInfo.grade = 'Wrong config : unknown condition';
      }
      priceInfo.grade = conditionToGrade[priceInfo.condition];
      priceInfo.CRCondition = gradeToCRCondition[priceInfo.grade];
      return priceInfo;
    })
    .filter(priceInfo => priceInfo.grade !== "") // Remove results with null CRCondition
    .sort((price1, price2) => {
      let comparison = 0;
      if (price1.grade > price2.grade) {
        comparison = 1;
      } else if (price1.grade < price2.grade) {
        comparison = -1;
      }
      return comparison;
    });

    return {
      vendorLabel: artoo.$('div.product-view div.product-name-container.not-small > h1').text().trim(),
      prices
    };
  }, config.occasion.recommerce.condition_equivalence, config.cashandrepair.condition_equivalence);

  return parsedDatas;
}

module.exports = {
  scrap
}
