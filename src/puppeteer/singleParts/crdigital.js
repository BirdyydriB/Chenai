const ScrapErrors = require('./../../errors.js');

const phoneVendorUrl = 'https://achat.crdigital.fr/';

async function scrap(page, phone, phoneSearchConstraint) {
  try {
    console.log('crdigital START');
    // Goto crdigital, waiting page to be fully loaded
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.goto(phoneVendorUrl, {
        timeout: 0
      })
    ]);

    // Login
    console.log('crdigital login');
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 0
      }),
      page.evaluate(async function() {
        await $('span.user-login > a').click();
        $('#username').focus();
        $('#username').val('CreativeClient');
        $('#password').val('SardaukarForever');
        $('#login-popup form button[type="submit"]').click();
      })
    ]);

    console.log('crdigital END');
    return parsedData;

  } catch (err) {
    return {
      error: err.message
    };
  }
}

module.exports = {
  scrap
}
