const config = require('./../../config.json');
const ScrapErrors = require('./../errors.js');

/**
 * Scrap a website and retry up to 4 times if NO_RESULT_FOUND
 *
 * @access public
 * @param {object} browser - The Puppeteer browser API object
 * @param {Phone} phone - The Phone object to search
 * @param {function} scrapFunction - Main function to scrap a vendor
 * @param {string} [debug=null] - Vendor name : to log console.log events on scraping. null : don't log.
 * @returns {object} The parsed datas or an object with an error attribute if something went wrong
 */
async function scrap(browser, phone, scrapFunction, debug = null) {

  for(var attempt = 1 ; attempt <= 4 ; attempt++) {
    var { page, bringToFrontInterval } = await openPage(browser, debug);

    const phoneSearchConstraint = ((attempt) => {
      switch(attempt) {
        case 1 :
          return {};
          break;
        case 2 :
          return { withColor: false };
          break;
        case 3 :
          return { withCapacity: false };
          break;
        case 4 :
          return { withColor: false, withCapacity: false };
          break;
    }})(attempt);

    var result;
    for(var attemptSameConstraint = 1 ; attemptSameConstraint <= config.nb_tentatives_max_par_site ; attemptSameConstraint++) {
      // Scrap or timeout... who will win ?
      result = await Promise.race([
        timeout(config.temps_max_par_site * 1000),
        scrapFunction(page, phone, phoneSearchConstraint)
      ]);
      result.try = attempt;

      if (!result.error || Object.values(ScrapErrors).indexOf(result.error) != -1) {
        // No error or it's a known one, do not need to retry with same constraint
        break;
      }
      else {
        // Close and reopen page, to restart on a clean page
        clearInterval(bringToFrontInterval);
        await page.close();
        var { page, bringToFrontInterval } = await openPage(browser, debug);
      }
    }

    // We have a result : stop bringing page to front
    clearInterval(bringToFrontInterval);

    if (!result.error || (result.error != ScrapErrors.NO_RESULT_FOUND && result.error != 'timeout') || (attempt == 4)) {
      // Found a result and it's not a "NO_RESULT_FOUND" neither a timeout : return the result
      // But if it's the last try (attempt == 4), return it anyway

      if (result.error && Object.values(ScrapErrors).indexOf(result.error) == -1) {
        // Unknown scraping error, replace by a generic error
        console.log('unexpected error', result.error);
        result.error = 'an unexpected error occurred during scraping';
      }

      return result;
    }

    // NO_RESULT_FOUND (or timeout) : retry
    await page.close();
  }
}

/**
 * Open a Puppeteer page
 *
 * @access public
 * @param {object} browser - The Puppeteer browser API object
 * @param {string} [debug=null] - Vendor name : to log console.log events on scraping. null : don't log.
 * @returns {object} The new opened page
 * @returns {object.page} The new opened Puppeteer page API object
 * @returns {object.bringToFrontInterval} The setInterval result, to regulary bring page to front
 */
async function openPage(browser, debug = null) {
  var page = await browser.newPage();
  if(debug) {
    // Log (with node) all chromium logs
    page.on('console', (log) => console.log('LOG ' + debug + ' : ' + log.text()));
  }

  // Regularly bringToFront, avoid beeing blocked on a scrap function
  var bringToFrontInterval = setInterval(function(page) {
    page.bringToFront();
  }, 3000, page);

  return { page, bringToFrontInterval };
}

/**
 * Async function to get parsing timeout
 *
 * @access public
 * @param {number} ms - Duration from which scraping is considered to be timeout (in ms)
 */
async function timeout(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms, {
      error: 'timeout'
    });
  });
}

/**
 * Inject Artoo's script in page
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 */
async function setArtoo(page) {
  await page.evaluate(function() {
    // Artoo's code
    window.artoo = Promise.resolve((function() {
      var t = {},
        e = !0;
      if ("object" == typeof this.artoo && (artoo.settings.reload || (artoo.log.verbose("artoo already exists within this page. No need to inject him again."), artoo.loadSettings(t), artoo.exec(), e = !1)), e) {
        var o = document.getElementsByTagName("body")[0];
        o || (o = document.createElement("body"), document.documentElement.appendChild(o));
        var a = document.createElement("script");
        console.log("artoo.js is loading..."), a.src = "//medialab.github.io/artoo/public/dist/artoo-latest.min.js", a.type = "text/javascript", a.id = "artoo_injected_script", a.setAttribute("settings", JSON.stringify(t)), o.appendChild(a)
      }
    }).call(this));
  });
  // Sleeping 3s to let Artoo initialize (I don't have a more elegant solution right now)
  await page.waitFor(3000);
}

/**
 * Inject levenshteinDistance (<=> distance beetween strings) function in page
 *
 * @access public
 * @param {object} page - The Puppeteer page API object
 */
async function setLevenshteinFunction(page) {
  await page.evaluate(() => {
    window.levenshteinDistance = function levenshteinDistance(a, b) {
      if (a.length == 0) return b.length;
      if (b.length == 0) return a.length;

      var matrix = [];
      // increment along the first column of each row
      var i;
      for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }

      // increment each column in the first row
      var j;
      for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      // Fill in the rest of the matrix
      for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) == a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
              Math.min(matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1)); // deletion
          }
        }
      }

      return matrix[b.length][a.length];
    }
  });
}

module.exports = {
  scrap,
  setArtoo,
  setLevenshteinFunction
}
