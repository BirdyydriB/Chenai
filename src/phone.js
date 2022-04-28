/**
 * A phone
 * @access public
 * @class
 */
class Phone {
  set brand(brand) {
    this._brand = brand;
  }
  get brand() {
    return this._brand;
  }
  set model(model) {
    this._model = model;
  }
  get model() {
    return this._model;
  }
  set color(color) {
    this._color = color;
  }
  get color() {
    return this._color;
  }
  set capacity(capacity) {
    this._capacity = capacity;
  }
  get capacity() {
    return this._capacity;
  }

  constructor() {
    return this;
  }

  /**
   * Pick a random json phone in the list below, parse it and return as a Phone
   *
   * @access public
   * @returns {Phone} A random Phone
   */
  static getRandomPhone() {
    const randomPhones = [
      '{"marque":"Apple", "modele":"iPhone 6", "couleur":"Gris sidéral", "capacite":"64Go"}',
      '{"marque":"Apple", "modele":"iPhone 11 Pro", "couleur":"vert nuit", "capacite":"256 Go"}',
      '{"marque":"WIKO", "modele":"View 2", "couleur":"Noir", "capacite":"32Go"}',
      '{"marque":"WIKO", "modele":"Sunny 3", "couleur":"Anthracite", "capacite":"8Go"}',
      '{"marque":"Wiko", "modele":"Tommy 2", "couleur":"Noir", "capacite":"8 Go"}',
      // '{"marque":"Nokia", "modele":"9 Pureview", "couleur":"Bleu", "capacite":"128 Go"}',
      // '{"marque":"Nokia", "modele":"3310", "couleur":"Noir", "capacite":""}',
      '{"marque":"Sony", "modele":"Xperia XZ2", "couleur":"Noir", "capacite":""}',
      '{"marque":"SONY", "modele":"Xperia XA1", "couleur":"Noir", "capacite":"32 Go"}',
      '{"marque":"HUAWEI", "modele":"P20", "couleur":"Noir", "capacite":"128Go"}',
      '{"marque":"HUAWEI", "modele":"P30", "couleur":"Bleu Nacré", "capacite":"128Go"}',
      // '{"marque":"ALCATEL", "modele":"Idol 4", "couleur":"Noir", "capacite":"16 Go"}',
      // '{"marque":"ALCATEL", "modele":"Pop 4", "couleur":"Gris", "capacite":"8 Go"}',
      '{"marque":"Samsung", "modele":"S10", "couleur":"rouge", "capacite":"128Go"}',
      '{"marque":"SAMSUNG", "modele":"Galaxy S6", "couleur":"Or", "capacite":"32 Go"}',
      // '{"marque":"SAMSUNG", "modele":"Licorne", "couleur":"Arc-en-ciel", "capacite":"128 To"}',
      // '{"marque":"Fhrtil", "modele":"Cfdsl", "couleur":"frr", "capacite":"catads"}',
      // '{"marque":"SAMSUNG", "modele":"Galaxy Grand Prime", "couleur":"Noir", "capacite":"8 Go"}',
    ];
    const randomJson = randomPhones[Math.floor(Math.random() * randomPhones.length)];
    return new Phone().parse(randomJson);;
  }

  /**
   * Parse a json, return a new Phone
   *
   * @access public
   * @param {object} jsonDatas - The json to parse
   * @returns {Phone} The parsed Phone
   */
  parse(jsonDatas) {
    const parsedDatas = JSON.parse(jsonDatas);
    if (!parsedDatas.hasOwnProperty('marque') || (parsedDatas['marque'] === undefined)) {
      throw new Error('Il manque la marque');
    }
    if (!parsedDatas.hasOwnProperty('modele') || (parsedDatas['modele'] === undefined)) {
      throw new Error('Il manque le modèle');
    }
    if (!parsedDatas.hasOwnProperty('couleur') || (parsedDatas['couleur'] === undefined)) {
      throw new Error('Il manque la couleur');
    }
    if (!parsedDatas.hasOwnProperty('capacite') || (parsedDatas['capacite'] === undefined)) {
      // throw new Error('Il manque la capacité');
    }

    this.brand = parsedDatas['marque'];
    this.model = parsedDatas['modele'];
    this.color = parsedDatas['couleur'];
    this.capacity = parsedDatas['capacite'];

    return this;
  }

  /**
   * Apply business rules to scraping results
   *
   * @access public
   * @param {object} options - Options to apply
   * @param {boolean} options.withQuotes - Should we put words beetween quotes ?
   * @param {boolean} options.withBrand - Should we display phone brand ?
   * @param {boolean} options.withModel - Should we display phone model ?
   * @param {boolean} options.withColor - Should we display phone color ?
   * @param {boolean} options.withCapacity - Should we display phone capacity ?
   * @param {boolean} options.randomly - Should we shuffle words ?
   * @returns {string} The phone as a string
   */
  toString({
    withQuotes = true,
    withBrand = true,
    withModel = true,
    withColor = true,
    withCapacity = true,
    randomly = false
  } = {}) {
    var result = [];
    var quotes = withQuotes ? '\"' : '';

    if (withBrand && (this.brand != ''))
      result.push(quotes + this.brand + quotes);
    if (withModel && (this.model != ''))
      result.push(quotes + this.model + quotes);
    if (withColor && (this.color != ''))
      result.push(quotes + this.color + quotes);
    if (withCapacity && (this.capacity != ''))
      result.push(quotes + this.capacity + quotes);

    if (randomly) {
      //Shuffle result
      for (let i = result.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
    }

    return result.join(' ');
  }
}

module.exports = {
  Phone: Phone
}
