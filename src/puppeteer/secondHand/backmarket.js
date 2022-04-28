const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setArtoo,
  setLevenshteinFunction
} = require('./../scraper.js');

const phoneVendorUrl = 'https://www.backmarket.fr';

/**
 * Main function to scrap backmarket
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('backmarket START');
    // Goto backmarket, waiting page to be fully loaded
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

    console.log('backmarket END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on backmarket
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  // Focus searchField and make user search
  const phoneSearch = phone.toString(phoneSearchConstraint);
  console.log('backmarket search', phoneSearch);
  await page.addScriptTag({
    url: 'https://code.jquery.com/jquery-3.2.1.min.js'
  });
  await page.evaluate(async () => {
    // Check focus out to keep focus on searchBar while typing
    $('#header > div.searchBar > form > input').focusout(() => {
      $('#header > div.searchBar > form > input').focus();
    });
    // Check change to avoid "lost" of first chars
    $('#header > div.searchBar > form > input').change((event) => {
      const currentValue = $('#header > div.searchBar > form > input').val();
      $('#header > div.searchBar > form > input').val(currentValue);
    });
  });
  await page.bringToFront();
  await page.focus('#header > div.searchBar > form > input');
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
    page.click('#header > div.searchBar > form > button[type=submit]', {
      delay: Math.random() * 200 + 50
    }),
  ]);

  // Check if backmarket found a phone
  const hasResults = (await page.$('div[data-test=search-landing-no-result]') == null);
  if (!hasResults) {
    throw new Error(ScrapErrors.NO_RESULT_FOUND);
  }
}

/**
 * Find the phone in backmarket search result
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function getPhoneFromSearch(page, phone) {
  console.log('backmarket select in result list');
  await page.bringToFront();
  await page.click('#main_container', {
    delay: Math.random() * 200 + 50
  });

  // Find result in list with minimum levenshtein distance
  await setLevenshteinFunction(page);

  var phoneSearch = phone.toString({ withQuotes: false, withColor: false });
  phoneSearch = (phoneSearch + ' ' + phone.color).toUpperCase(); // Backmarket put color after capacity... do the same
  const minimumLevenshteinLink = await page.evaluate((phoneSearch) => {
    var minimumLevenshtein = 999;
    var minimumLevenshteinLink = '';
    document.querySelectorAll('#main_container section.u-container > div > ul > li > div > a').forEach((a) => {
        const label = a.querySelector('div > h2').innerText
          .replace(' - Débloqué', '')
          .toUpperCase()
          .replace(/ - /g, '')
          .replace(/  /g, ' ')
          .trim();
        const levenshtein = levenshteinDistance(label, phoneSearch);

        if (levenshtein < minimumLevenshtein) {
          minimumLevenshtein = levenshtein;
          minimumLevenshteinLink = a.getAttribute('href');
        }
    });
    return minimumLevenshteinLink;
  }, phoneSearch);

  await Promise.all([
    page.waitForSelector('div.grade-bar > div > button', {
      timeout: 0
    }),
    page.goto(phoneVendorUrl + minimumLevenshteinLink, {
      delay: Math.random() * 200 + 50,
      timeout: 0
    })
  ]);
}

/**
 * Parse backmarket result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('backmarket parse result');
  // Inject artoo.js and scrap
  await setArtoo(page);
  await page.bringToFront();

  var parsedDatas = await page.evaluate((conditionToGrade, gradeToCRCondition) => {
    var prices = artoo.scrape('div.grade-bar > div > button', {
      condition: function() {
        const buttonChildren = artoo.$(this).children();
        var conditionStr = artoo.$(buttonChildren[buttonChildren.length - 2]).html();
        return conditionStr.trim();
      },
      isPromo: function() {
        const promo = artoo.$(this).find('div > div');
        if (promo.length > 0) {
          return (promo.text() == "bon plan !");
        }
        return false;
      },
      price: function() {
        const buttonChildren = artoo.$(this).children();
        var priceStr = artoo.$(buttonChildren[buttonChildren.length - 1]).html();
        if (priceStr == 'Déjà vendu') {
          return -1;
        }

        return parseFloat(priceStr.slice(0, priceStr.length - 1)
          .replace(',', '.')
          .replace(/\s|&nbsp;/g, ''));
      }
    })
    .filter(priceInfo => priceInfo.price !== -1) // Remove "Déjà vendu" from list
    .map((priceInfo) => {
      if ( !conditionToGrade.hasOwnProperty(priceInfo.condition) ) {
        // Something wrong in config : missing category keyWordCategories[keyWord]
        priceInfo.grade = 'Wrong config : unknown condition';
      }
      priceInfo.grade = conditionToGrade[priceInfo.condition];
      priceInfo.CRCondition = gradeToCRCondition[priceInfo.grade];

      if (priceInfo.isPromo && artoo.$('del.price').length > 0) {
        priceInfo.oldPrice = parseFloat(artoo.$('del.price:first').text()
          .replace(',', '.')
          .replace('€', '')
          .trim());
      }

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
      vendorLabel: artoo.$('div.m-container-productmain > div.infos-middle > h1').text().trim(),
      prices
    };

  }, config.occasion.backmarket.condition_equivalence, config.cashandrepair.condition_equivalence);

  return parsedDatas;
}

module.exports = {
  scrap
}
