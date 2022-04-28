//-------------------- Puppeteer
const puppeteer = require('puppeteer');

//-------------------- Phone & Scrappers
const phone = require('./phone.js');
const scraper = require('./puppeteer/scraper.js');
const fnac = require('./puppeteer/secondHand/fnac.js');
const easycash = require('./puppeteer/secondHand/easycash.js');
const darty = require('./puppeteer/new/darty.js');
const backmarket = require('./puppeteer/secondHand/backmarket.js');
const rachatdemobile = require('./puppeteer/secondHand/rachatdemobile.js');
const ldlc = require('./puppeteer/new/ldlc.js');
const boulanger = require('./puppeteer/new/boulanger.js');
const cdiscount = require('./puppeteer/new/cdiscount.js');
// const crdigital = require('./puppeteer/singleParts/crdigital.js');
const utopya = require('./puppeteer/singleParts/utopya.js');
const sosav = require('./puppeteer/singleParts/sosav.js');
const aswo = require('./puppeteer/singleParts/aswo.js');
const chronospare = require('./puppeteer/singleParts/chronospare.js');
const recommerce = require('./puppeteer/secondHand/recommerce.js');

//-------------------- Others
const businessRules = require('./businessRules.js');

//-------------------- Vars
const debugMode = (process.env.NODE_ENV === 'development');

//-------------------- Functions
/**
 * Return the scraping function of a vendor, given his name
 *
 * @access public
 * @param {object} scraperName - The scraper name
 * @returns {function} The vendor scraping function
 */
function getScraper(scraperName) {
  var vendorScrapper;
  switch (scraperName) {
    case 'easycash':
      vendorScrapper = easycash.scrap;
      break;
    case 'backmarket':
      vendorScrapper = backmarket.scrap;
      break;
    case 'rachatdemobile':
      vendorScrapper = rachatdemobile.scrap;
      break;
    case 'ldlc':
      vendorScrapper = ldlc.scrap;
      break;
    case 'boulanger':
      vendorScrapper = boulanger.scrap;
      break;
    case 'cdiscount':
      vendorScrapper = cdiscount.scrap;
      break;
    case 'utopya':
      vendorScrapper = utopya.scrap;
      break;
    case 'sosav':
      vendorScrapper = sosav.scrap;
      break;
    case 'aswo':
      vendorScrapper = aswo.scrap;
      break;
    case 'chronospare':
      vendorScrapper = chronospare.scrap;
      break;
    case 'recommerce':
      vendorScrapper = recommerce.scrap;
      break;
    default:
      return false;
      // res.status(404).send('Unknown vendor');
      break;
  }
  return vendorScrapper;
}

/**
 * Return the scraping result of a vendor
 *
 * @access public
 * @param {Phone} requestedPhone - The resquested phone
 * @param {string} vendorName - The vendor name
 * @param {object} browser - The Puppeteer browser API object
 * @returns {object} The scraping result
 */
async function scrapVendor(requestedPhone, vendorName, browser) {
  var vendorScrapper = getScraper(vendorName);
  var scrapResult = {};
  scrapResult[vendorName] = await scraper.scrap(browser, requestedPhone, vendorScrapper/*, vendorName*/);
  console.log(vendorName + ' scrap result', JSON.stringify(scrapResult[vendorName]));
  return scrapResult;
}

/**
 * Return the scraping result of an array of vendors
 *
 * @access public
 * @param {string} phoneJSON - The resquested phone as a json
 * @param {Array<string>} vendorsNames - The vendors names
 * @returns {object} result - The scraping results
 * @returns {object} result.phone - The scrapped phone
 * @returns {string} result.phoneSearch - The scrapped phone string
 * @returns {string} result.date - Date of the resquest
 * @returns {string} result.(vendorName) - The parsed result of a given vendor
 * @returns {?object} result.newPrices - Price once business rules applied, for new vendors
 * @returns {?object} result.secondHandPrices - Prices per condition once business rules applied, for secondHand vendors
 */
async function scrapVendors(phoneJSON, vendorsNames) {
  const requestedPhone = (phoneJSON === 'random') ?
    phone.Phone.getRandomPhone() :
    new phone.Phone().parse(phoneJSON);

  const browser = await puppeteer.launch({
    headless: !debugMode,
  });

  var allResults = {
    phoneSearch: requestedPhone.toString({
      withQuotes: false
    }),
    date: new Date(),
  };
  var promises = []
  for(vendorName of vendorsNames) {
    promises.push(scrapVendor(requestedPhone, vendorName, browser));
  }

  return Promise.all(promises).then((scrapValues) => {
    browser.close();

    for(scrapValue of scrapValues) {
      const scrapName = Object.keys(scrapValue)[0];
      allResults[scrapName] = scrapValue[scrapName];
    }

    return allResults;
  });
}

/**
 * Build Chenaï routes
 *
 * @access public
 * @param {object} app - The Express app API object
 */
const initRoutes = function(app) {

  /**
   * Apply business rules to scraped prices
   *
   * @access public
   * @param {string} :datas - The previously scraped datas
   * @returns {object} result - The business rules applied
   */
  app.get('/businessRules/:datas', async function(req, res) {
    try {

      const prices = businessRules.applyRules(JSON.parse(req.params.datas));
      res.status(200).send(prices);

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });

  /**
   * Return the scraping result of all vendors
   *
   * @access public
   * @param {string} :phone - The resquested phone as a json
   * @returns {object} result - The scraping result
   */
  app.get('/all/:phone', async function(req, res) {
    try {
      const toScrap = ['easycash', 'backmarket', 'rachatdemobile', 'ldlc', 'boulanger', 'cdiscount', 'utopya', 'sosav', 'aswo', 'chronospare', 'recommerce'];

      const allResults = await scrapVendors(req.params.phone, toScrap);
      const prices = businessRules.applyRules(allResults);

      res.status(200).send(prices);

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });

  /**
   * Return the scraping result of second hands vendors
   *
   * @access public
   * @param {string} :phone - The resquested phone as a json
   * @returns {object} result - The scraping result
   */
  app.get('/old/:phone', async function(req, res) {
    try {
      const toScrap = ['easycash', 'backmarket', 'rachatdemobile', 'recommerce'];

      const allResults = await scrapVendors(req.params.phone, toScrap);
      const prices = businessRules.applyRules(allResults);

      res.status(200).send(prices);

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });

  /**
   * Return the scraping result of the vendors of new
   *
   * @access public
   * @param {string} :phone - The resquested phone as a json
   * @returns {object} result - The scraping result
   */
  app.get('/new/:phone', async function(req, res) {
    try {
      const toScrap = ['ldlc', 'boulanger', 'cdiscount'];

      const allResults = await scrapVendors(req.params.phone, toScrap);
      const prices = businessRules.applyRules(allResults);

      res.status(200).send(prices);

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });

  /**
   * Return the scraping result of single parts vendors
   *
   * @access public
   * @param {string} :phone - The resquested phone as a json
   * @returns {object} result - The scraping result
   */
  app.get('/parts/:phone', async function(req, res) {
    try {
      const toScrap = ['utopya', 'sosav', 'aswo', 'chronospare'];

      const allResults = await scrapVendors(req.params.phone, toScrap);
      const prices = businessRules.applyRules(allResults);

      res.status(200).send(prices);

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });

  /**
   * Return the scraping result of a given vendor
   *
   * @access public
   * @param {string} :vendor - The vendor name
   * @param {string} :phone - The resquested phone as a json
   * @returns {object} result - The scraping result
   */
  app.get('/vendor/:vendor/:phone', async function(req, res) {
    try {
      const toScrap = [req.params.vendor];

      const allResults = await scrapVendors(req.params.phone, toScrap);
      const prices = businessRules.applyRules(allResults);

      res.status(200).send(prices);

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });

  /**
   * Is this item available on sosav
   * WARNING Could not work with items with differents colors
   *
   * @access public
   * @param {string} :url - The url of the detailed page of the item
   * @returns {boolean} result.available - It's available
   */
  app.get('/sosav/available/:url', async function(req, res) {
    try {
      const browser = await puppeteer.launch({
        headless: !debugMode,
      });
      const available = await sosav.isAvailable(browser, req.params.url);
      res.status(200).send({
        available: available
      });

    } catch (err) {
      console.log('Big Error :', err);
      res.status(500).send('Server error');
    }
  });
}

module.exports = {
  initRoutes
}
