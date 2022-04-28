const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setArtoo,
  setLevenshteinFunction
} = require('./../scraper.js');
const { median } = require('./../../businessRules.js');

const phoneVendorUrl = 'https://www.rachatdemobile.com';

/**
 * Main function to scrap rachatdemobile
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('rachatdemobile START');
    // Goto rachatdemobile, waiting page to be fully loaded
    await Promise.all([
      page.waitForSelector('body > section.searchBar.jsSearchBar > div > form > input[type=search]', {
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

    console.log('rachatdemobile END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on rachatdemobile
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  // Focus searchField and make user search
  phoneSearchConstraint.withQuotes = false; // rachatdemobile doesn't accept quotes
  const phoneSearch = phone.toString(phoneSearchConstraint);
  console.log('rachatdemobile search', phoneSearch);
  await page.bringToFront();
  await page.focus('body > section.searchBar.jsSearchBar > div > form > input[type=search]');
  await page.keyboard.type(phoneSearch, {
    delay: 100
  });
  await page.waitFor(Math.floor(Math.random() * 100 + 50));
  await page.bringToFront();

  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('body > section.searchBar.jsSearchBar > div > form > button', {
      delay: Math.random() * 200 + 50
    }),
  ]);
  await page.waitFor(Math.random() * 1000 + 500);
  await page.bringToFront();

  // Check if rachatdemobile found a phone
  if (await page.$('#wrapper > div.searchCounterResult.offers > span') != null) {
    const hasResults = await page.$eval('#wrapper > div.searchCounterResult.offers > span', (searchResult) => {
      return !searchResult.innerHTML.startsWith('Aucun résultat');
    });
    if (!hasResults) {
      throw new Error(ScrapErrors.NO_RESULT_FOUND);
    }
  }
}

/**
 * Find the phone in rachatdemobile search result
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function getPhoneFromSearch(page, phone) {
  console.log('rachatdemobile select in result list');
  // Check if rachatdemobile found only one product (and already open detailed page), or a list of products
  if (await page.$('.ficheProduit') == null) {
    await page.waitForSelector('#wrapper > ul', {
      timeout: 0
    });

    // Find result in list with minimum levenshtein distance
    await setLevenshteinFunction(page);

    const phoneSearchWithCap = phone.toString({ withQuotes: false, withColor: false, withCapacity: true }).toUpperCase();
    const phoneSearchWithoutCap = phone.toString({ withQuotes: false, withColor: false, withCapacity: false }).toUpperCase();
    const minimumLevenshteinLink = await page.evaluate((phoneSearchWithCap, phoneSearchWithoutCap) => {
      var minimumLevenshtein = 999;
      var minimumLevenshteinLink = '';
      $('#wrapper > ul > li > a').each((index, a) => {
        const label = $(a).text().trim().toUpperCase();
        const phoneSearch = label.endsWith('GO') ?
          phoneSearchWithCap : // If results contains capacity info, look for it...
          phoneSearchWithoutCap; // ... or not
        const levenshtein = levenshteinDistance(label, phoneSearch);

        // console.log(phoneSearch, ' : ', label, ' => ', levenshtein);
        if (levenshtein < minimumLevenshtein) {
          minimumLevenshtein = levenshtein;
          minimumLevenshteinLink = $(a).attr('href');
        }
      });
      return minimumLevenshteinLink;
    }, phoneSearchWithCap, phoneSearchWithoutCap);

    await page.bringToFront();
    await Promise.race([
      page.waitForSelector('#wrapper > section.spanSmall > section', {
        timeout: 0
      }),
      page.goto(phoneVendorUrl + minimumLevenshteinLink, {
        timeout: 0
      })
    ]);
  }
}

/**
 * Parse rachatdemobile result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('rachatdemobile parse result');
  await setArtoo(page);
  await page.bringToFront();

  var parsedDatas = await page.evaluate((conditionToGrade, gradeToCRCondition) => {
    var prices = artoo.scrape('#wrapper > section.spanSmall > section', {
      condition: function() {
        var conditionStr = artoo.$(this).find('.etat').text();
        return conditionStr.trim();
      },
      isPromo: () => false,
      price: function() {
        var priceStr = artoo.$(this).find('.prix').html();
        return parseFloat(priceStr.trim()
          .slice(0, priceStr.length - 1)
          .replace(',', '.'));
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

    var newPrice = {
      condition: "Comme neuf",
      isPromo: false,
      prices: [],
      grade: 'A',
      CRCondition: gradeToCRCondition['A']
    };
    artoo.$('.prixNeuf').each((index, prixNeuf) => {
    	var priceStr = artoo.$(prixNeuf).text()
    		.slice(13) // Remove 'Comme neuf : ' text
    		.replace('€', '')
    		.replace(',', '.')
    		.trim();
    	newPrice.prices.push(parseFloat(priceStr));
    });
    prices.unshift(newPrice);

    return {
      vendorLabel: artoo.$('h1 > span.ficheProduitName').text().trim(),
      prices
    };
  }, config.occasion.rachatdemobile.condition_equivalence, config.cashandrepair.condition_equivalence);

  // Get the median value for 'new' condition
  parsedDatas.prices[0].price = median(parsedDatas.prices[0].prices);

  return parsedDatas;
}

module.exports = {
  scrap
}
