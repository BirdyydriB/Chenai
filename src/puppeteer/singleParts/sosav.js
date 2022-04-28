const config = require('./../../../config.json');
const ScrapErrors = require('./../../errors.js');
const {
  setLevenshteinFunction,
  setArtoo
} = require('./../scraper.js');

const phoneVendorUrl = 'https://www.sosav.fr/store/1412-smartphones';

/**
 * Main function to scrap sosav
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 * @param {object} phoneSearchConstraint - The search constraints (color, brand, model...)
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('sosav START');
    // Goto sosav
    await Promise.race([
      page.waitForSelector('#subcategories > ul', {
        timeout: 0
      }),
      page.goto(phoneVendorUrl, {
        timeout: 0
      })
    ]);

    await page.waitFor(6000); // get Jquery some time to load
    await search(page, phone);

    await page.waitFor(Math.random() * 500 + 200);
    const parsedDatas = await parseResult(page);

    console.log('sosav END');
    return parsedDatas;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

/**
 * To make search on sosav
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @param {Phone} phone - The Phone object to search
 */
async function search(page, phone) {
  console.log('sosav search', phone.brand + ' then ' + phone.model);
  // Search phone brand
  await page.bringToFront();
  const brandUrl = await page.evaluate(async function(phone) {
    var brandUrlFounded;
    $('#subcategories > ul > li').each((index, li) => {
      var brand = $(li).text()
        .trim()
        .toUpperCase()
        .replace('IPHONE', 'APPLE');

      if (brand == phone._brand.toUpperCase()) {
        brandUrlFounded = $(li).find('a').attr('href');
      }
    });

    return brandUrlFounded;
  }, phone);

  if (!brandUrl) {
    throw new Error(ScrapErrors.BRAND_NOT_FOUND);
  }

  // Go to brand detail
  await Promise.race([
    page.goto(brandUrl, {
      timeout: 0
    }),
    page.waitForSelector('#subcategories > ul', {
      timeout: 0
    })
  ]);

  await page.waitFor(Math.random() * 500 + 200);

  // Add levenshtein function and search the phone model
  await setLevenshteinFunction(page);
  const phoneSinglePartsUrl = await page.evaluate(async function(phone) {
    var modelsUrl = [];
    var modelUrl;

    $('#subcategories > ul > li').each((index, li) => {
      const model = $(li).text().trim().toUpperCase();
      const levenshtein = levenshteinDistance(model, phone._model.toUpperCase());
      if ((model == phone._model.toUpperCase()) || (model == phone._brand.toUpperCase() + ' ' + phone._model.toUpperCase())) {
        // Model founded
        modelUrl = $(li);
      }
      // In case we never find the exact same model name
      modelsUrl.push({
        levenshtein: levenshtein,
        model: model,
        DOM: $(li)
      });
    });

    if (modelUrl) {
      // Exact model founded, return single parts URL
      return modelUrl.find('a').attr('href');
    } else {
      // Sort to get modelUrl with minimum levenshtein distance, hope this is the searched phone...
      modelsUrl = modelsUrl.sort((modelObject1, modelObject2) => {
        let comparison = 0;
        if (modelObject1.levenshtein > modelObject2.levenshtein) {
          comparison = 1;
        } else if (modelObject1.levenshtein < modelObject2.levenshtein) {
          comparison = -1;
        }
        return comparison;
      });
      // Return single parts URL of the nearest phone founded
      return modelsUrl[0].DOM.find('a').attr('href');
    }
  }, phone);

  // Go to model detail
  await Promise.race([
    page.goto(phoneSinglePartsUrl, {
      timeout: 0
    }),
    page.waitForSelector('ul.product_list', {
      timeout: 0
    })
  ]);
}

/**
 * Parse sosav result page(s) and return the parsed datas
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 * @returns {object} The parsed datas
 */
async function parseResult(page) {
  console.log('sosav parseResult');
  await setLevenshteinFunction(page);
  await setArtoo(page);
  await page.bringToFront();

  const parsedDatas = await page.evaluate((singlePartsCategories, keyWordCategories, forbidenKeyWords ) => {
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
        return artoo.$(this).find('.product-name').text().trim();
      },
      href: function() {
        return artoo.$(this).find('a').attr('href');
      },
      price: function() {
        return {
          'net': parseFloat(artoo.$(this).find('.content_price > .price').attr('content'))
        };
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
              item.sosavKeyWord = keyWord;
              item.sosavMissingCategory = keyWordCategories[keyWord];
              if( !singlePartsResult.hasOwnProperty('wrongCategoryEquivalence') ) {
                singlePartsResult.wrongCategoryEquivalence = [];
              }

              singlePartsResult.wrongCategoryEquivalence.push(item);
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
            const currentLevenshtein = levenshteinDistance(singlePart.toUpperCase(), item.label.toUpperCase());
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

  }, config.pieces_detachees.categories, config.pieces_detachees.sosav.mots_clefs_categories, config.pieces_detachees.sosav.mots_clefs_interdits);

  return parsedDatas;
}

async function isAvailable(browser, url) {
  var colorsAvailability = [];
  var page = await browser.newPage();

  await Promise.race([
    page.waitForSelector('#availability_value', {
      timeout: 0
    }),
    page.goto(url, {
      timeout: 0
    })
  ]);
  await page.waitFor(3000); // get Jquery some time to load

  if (await page.$('#color_to_pick_list') != null) {
    // Get the differents colors and put an observer on availability_statut change
    colorsAvailability = await page.evaluate((colorsAvailability) => {
      const observer = new MutationObserver(function() {
        // Communicate with node through console.log method
        console.log('__mutation')
      });
      // Observe a change on availability_statut childs
      observer.observe(document.getElementById('availability_statut'), { childList: true, subtree: true });

      // Get all colors
      $('#color_to_pick_list > li > a').each((index, a) => {
        const color = $(a).attr('name')
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(' ', '_');

        colorsAvailability.push({
          color: $(a).attr('title'),
          link: $(a).attr('href') + '#/couleur-' + color
        });
      });

      return colorsAvailability;
    }, colorsAvailability);

    var currentColorIndex = 0;
    var colorsParsed = false;
    // Observe __mutation changes which means, availability_value has change
    page.on('console', async (msg) => {
      if (msg._text === '__mutation') {
        var currentAvailability = await page.$eval('#availability_value', span => span.innerText);
        colorsAvailability[currentColorIndex].availability = currentAvailability;
        delete colorsAvailability[currentColorIndex].link;

        currentColorIndex++;
        if(currentColorIndex < colorsAvailability.length) {
          // Check next color availability
          await page.goto(colorsAvailability[currentColorIndex].link, {
            timeout: 0
          });
        }
        else {
          // All colors parsed
          colorsParsed = true;
        }
      }
    });

    // Select first color
    await page.goto(colorsAvailability[currentColorIndex].link, {
      timeout: 0
    });
    // And wait until it's finish
    while(!colorsParsed) {
    }

  }
  else {
    const availability = await page.$eval('#availability_value', span => span.innerText);

    colorsAvailability.push({
      color: 'none',
      availability: availability
    });
  }

  return colorsAvailability;
}

module.exports = {
  scrap,
  isAvailable
}
