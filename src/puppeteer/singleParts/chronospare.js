const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setLevenshteinFunction,
  setArtoo
} = require('./../scraper.js');

const phoneVendorUrl = 'http://chronospare.com/index.php?controller=my-account';

/**
 * Main function to scrap chronospare
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('chronospare START');
    // Goto utopya, waiting page to be fully loaded
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto(phoneVendorUrl, {
        timeout: 0
      })
    ]);

    if ((await page.$('a.login') != null) && (await page.$('a.logout') == null)) {
      await page.waitFor(Math.random() * 500 + 200);
      await logToChronospare(page);
    }

    await page.waitFor(Math.random() * 500 + 200);
    await search(page, phone);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page);

    console.log('chronospare END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To log on chronospare
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 */
async function logToChronospare(page) {
  console.log('chronospare login');
  await page.bringToFront();
  // Set login
  await page.bringToFront();
  await page.focus('#email');
  await page.keyboard.type(config.pieces_detachees.chronospare.login, {
    delay: 100
  });
  // Set password
  await page.waitFor(Math.random() * 100 + 50);
  await page.bringToFront();
  await page.focus('#passwd');
  await page.keyboard.type(config.pieces_detachees.chronospare.password, {
    delay: 100
  });
  // Validate
  await page.waitFor(Math.random() * 100 + 50);
  await page.bringToFront();
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 0
    }),
    page.click('#SubmitLogin', {
      delay: Math.random() * 200 + 50
    })
  ]);
}

/**
 * To make search on chronospare
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function search(page, phone) {
  // Focus searchField and make user search
  const phoneSearch = phone.toString({
    withBrand: (phone.model.length > 3),
    withColor: false,
    withCapacity: false,
    withQuotes: false
  });
  console.log('chronospare search ', phoneSearch);
  await page.bringToFront();
  await page.focus('#search_query_top');
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
    page.click('#searchbox > button', {
      delay: Math.random() * 200 + 50
    }),
  ]);

  // Check if chronospare found a phone
  await page.bringToFront();
  if (await page.$('#center_column > p') != null) {
    const hasResults = await page.$eval('#center_column > p', (searchResult) => {
      return !(searchResult && searchResult.innerHTML.trim().startsWith('Aucun résultat'));
    });
    if (!hasResults) {
      throw new Error(ScrapErrors.MODEL_NOT_FOUND); // Only one try
    }
  }
}

/**
 * Parse chronospare result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('chronospare parseResult');
  if(await page.$('#pagination > form.showall > div > button') != null) {
    // If 'Afficher tout' buton exist, click on it : show all result
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.click('#pagination > form.showall > div > button', {
        delay: Math.random() * 200 + 50
      }),
    ]);
  }

  await setLevenshteinFunction(page);
  await setArtoo(page);
  await page.bringToFront();

  var parsedDatas = await page.evaluate((singlePartsCategories, keyWordCategories, forbidenKeyWords) => {
    // Init result
    var singlePartsResult = {};
    var normalizedCategories = [];
    for(singlePart of singlePartsCategories) {
      singlePartsResult[singlePart] = [];
      normalizedCategories.push({
        'category': singlePart,
        'normalized': singlePart.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase()
      });
    }
    const normalizedForbidenKeyWords = forbidenKeyWords.map(keyWord => keyWord.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase());

    $.each(artoo.scrape('ul.product_list > li.ajax_block_product', {
      label: function() {
        return artoo.$(this).find('a.product-name').text().trim();
      },
      href: function() {
        return artoo.$(this).find('a.product-name').attr('href');
      },
      price: function() {
        return {
          'net': parseFloat(artoo.$(this).find('span.price.product-price')
            .text()
            .replace('€', '')
            .replace(',', '.')
            .trim())
        };
      },
      available: function() {
        return (artoo.$(this).find('span.availability').text().trim() != 'Prochainement');
      },
      availability: function() {
        availabilityStr = artoo.$(this).find('span.availability').text().trim();
        if(availabilityStr != 'Prochainement') {
          return availabilityStr.slice(13); // Remove 'Disponible : '
        }
      }
    }), function(indexItem, item) {
      const itemLabel = item.label.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
      var deletedItem = false;

      // Look for forbiden keyWorld
      for (forbidenKeyWord of normalizedForbidenKeyWords) {
        if (itemLabel.indexOf(forbidenKeyWord) != -1) {
          // Item will be 'deleted'
          if( !singlePartsResult.hasOwnProperty('deletedItem') ) {
            singlePartsResult.deletedItem = [];
          }

          singlePartsResult.deletedItem.push(item);
          deletedItem = true;
        }
      }

      if (!deletedItem) {
        // Look for importants keywords, that should determine category :
        var isImportant = false;
        // 1 - If we found category name in itemLabel
        for (singlePartCategory of normalizedCategories) {
          if (itemLabel.indexOf(singlePartCategory.normalized) != -1) {
            singlePartsResult[singlePartCategory.category].push(item);
            isImportant = true;
          }
        }
        // 2 - If we found some config keywords in itemLabel
        for (keyWord in keyWordCategories) {
          const normalizedKeyWord = keyWord.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();

          if (itemLabel.indexOf(normalizedKeyWord) != -1) {
            if( singlePartsResult.hasOwnProperty(keyWordCategories[keyWord]) ) {
              singlePartsResult[keyWordCategories[keyWord]].push(item);
            }
            else {
              // Something wrong in config : missing category keyWordCategories[keyWord]
              item.chronospareKeyWord = keyWord;
              item.chronospareMissingCategory = keyWordCategories[keyWord];
              if( !singlePartsResult.hasOwnProperty('wrongCategoryEquivalence') ) {
                singlePartsResult['wrongCategoryEquivalence'] = [];
              }

              singlePartsResult['wrongCategoryEquivalence'].push(item);
            }

            isImportant = true;
          }
        }

        if (!isImportant) {
          // var allLevenshtein = []; // For Debug
          var minimumLevenshtein = {
            distance: 9999,
            categorie: ''
          };
          $.each(singlePartsCategories, function(indexSinglePart, singlePart) {
            const currentLevenshtein = levenshteinDistance(singlePart.toUpperCase(), itemLabel);
            // allLevenshtein.push({
            //   distance: currentLevenshtein,
            //   categorie: singlePart
            // });
            if (currentLevenshtein < minimumLevenshtein.distance) {
              minimumLevenshtein = {
                distance: currentLevenshtein,
                categorie: singlePart
              };
            }
          });

          // item.allLevenshtein = allLevenshtein;
          // Push item in result (group by categorie)
          singlePartsResult[minimumLevenshtein.categorie].push(item);
        }
      }

      return item;
    });

    return singlePartsResult;

  }, config.pieces_detachees.categories, config.pieces_detachees.chronospare.mots_clefs_categories, config.pieces_detachees.chronospare.mots_clefs_interdits);

  return parsedDatas;
}

module.exports = {
  scrap
}
