const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setArtoo
} = require('./../scraper.js');

const phoneVendorUrl = 'https://www.easycash.fr';

/**
 * Main function to scrap easycash
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('easycash START');
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

    console.log('easycash END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on easycash
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 */
async function search(page, phone, phoneSearchConstraint) {
  // Focus searchField and make user search
  const phoneSearch = phone.toString(phoneSearchConstraint); //{ withQuotes: true }
  console.log('easycash search ', phoneSearch);
  await page.bringToFront();
  await page.focus('#search-field');
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
    page.click('button[type="submit"].btn-search', {
      delay: Math.random() * 200 + 50
    }),
  ]);

  // Check if easycash found a phone
  await page.bringToFront();
  const hasResults = (await page.$('.no-result') == null);
  if (!hasResults) {
    throw new Error(ScrapErrors.NO_RESULT_FOUND);
  }
}

/**
 * Find the phone in easycash search result
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function getPhoneFromSearch(page, phone) {
  // Click on first result founded TODO check equivalency with
  console.log('easycash select in result list');
  await page.waitForSelector('#searchContainer > div.main-content.search-results > div > ul > li:nth-child(1) > div.info > h2 > a', {
    timeout: 0
  });
  await page.bringToFront();
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('#searchContainer > div.main-content.search-results > div > ul > li:nth-child(1) > div.info > h2 > a', {
      delay: Math.random() * 200 + 50
    })
  ]);
}

/**
 * Parse easycash result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('easycash parse result');
  // Inject artoo.js and scrap
  await setArtoo(page);
  await page.bringToFront();

  var parsedDatas = await page.evaluate((conditionToGrade, gradeToCRCondition) => {
    var prices = artoo.scrape('div.tab > div.tab_links > a.choose-grade-tab', {
      condition: function() {
        var conditionStr = artoo.$(this).find('.condition').html();
        conditionStr = conditionStr.slice(0, conditionStr.indexOf('<span')).trim();
        return conditionStr;
      },
      isPromo: () => false,
      price: function() {
        var priceStr = artoo.$(this).find('.price').html();
        return parseFloat(priceStr.slice(0, priceStr.indexOf('&'))
          .replace(',', '.')
          .trim());
      }
    })
    .map((priceInfo) => {
      if ( !conditionToGrade.hasOwnProperty(priceInfo.condition) ) {
        // Something wrong in config : missing category keyWordCategories[keyWord]
        priceInfo.grade = 'Wrong config : unknown condition';
      }
      priceInfo.grade = conditionToGrade[priceInfo.condition];
      priceInfo.CRCondition = gradeToCRCondition[priceInfo.grade];

      if (artoo.$('img.sticker[alt="Promo"]').length > 0) {
        priceInfo.isPromo = true;
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
      vendorLabel: artoo.$('#content div.block-product > h1 > span').text().trim(),
      prices
    };

  }, config.occasion.easycash.condition_equivalence, config.cashandrepair.condition_equivalence);

  return parsedDatas;
}

module.exports = {
  scrap
}
