/**
 * Interacting with Google APIs, made a cinch
 * @author Adam Morris https://classroomtechtools.com classroomtechtools.ctt@gmail.com  
 * @lastmodified 11 April 2020
 * @version 0.6 Adam Morris: First draft with oauth fix
 * @library MsIomH3IL48mShjNoiUoRiq8b30WIDiE_ (not open to public yet)
 */
 

class DiscoveryCache_ {
    constructor () {
      this.cache = CacheService.getScriptCache();
    }
    
    getUrl ({name, version, resource, method}={}) {
      const key = `${name}${version}${resource}${method}`;
      let data = this.cache.get(key);
      let ret = null;
      if (data) {
        return data;
      }
      data = this.getEndpoint(name, version).json;
      if (resource.indexOf('.') === -1) {
        // straightforward
        ret = data.baseUrl + data.resources[resource].methods[method].path;
      } else {
        // resources can be dot-noted in order to resolve a path, e.g. sheets.spreadsheets.values, sheets.spreadsheets.developerMetadata
        let resources = data;
        resource.split('.').forEach(function (res) {
          resources = resources.resources[res];
        });
        ret = data.baseUrl + resources.methods[method].path;
      }

      this.cache.put(key, ret, 21600);  // max is 6 hours
      return ret;
    }
    
    getEndpoint(name, version) {
      return new Requests_().get({url: `https://www.googleapis.com/discovery/v1/apis/${name}/${version}/rest`}).fetch();
    }
   
}

/*
 * Throw error if property of a class does not exist; helps with development
 */ 
function KlassProxy_ (klass) {
  return new Proxy(klass, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      } else {
        throw new Error(`No method or property ${prop} in class ${klass.constructor.name}`);
      }
    }
  });
}

class Interface_ {
  constructor (n, p) {
    this.name = n;
    this.params = p;
  }
    
  get req() {
    throw new Error(`Missing at least one required parameter for ${this.name}: ${this.params}`);
  }

  extra(kwargs) {
    if (!kwargs) return;
    if (Object.keys(kwargs).length > 0) 
      throw new Error(`Extra parameters passed to ${this.name}: ${Object.keys(kwargs)}`);
  }

  static new (...args) {
    return new Interface_(...args);
  }
}
  
const D_ = Interface_.new('Discovery', ['name', 'version', 'resource', 'method']);

class Utils_ {
  validateDiscovery ({
    name=     D_.req,
    version=  D_.req,
    resource= D_.req,
    method=   D_.req,
    ...kwargs
  }={}) {
    D_.extra(kwargs);
    return true;
  }
  
  interpolate (targetString, params) {
    const names = Object.keys(params);
    const vals = Object.values(params);
    return new Function(...names, `return \`${targetString}\`;`)(...vals);
  }
  
  translateToTemplate (string) {
    // Use special patterns avaliable in second parameter go from a {} to ${}
    return string.replace(/{\+*([a-zA-Z_.]*?)}/g, function (one) {
      return '$' + one.replace('.', '_');
    });
  }
  
  /*
   * Convert an obj to string of params
   */
  makeQueryString ({...kwargs}={}) {
    const arr = Object.entries(kwargs).reduce( 
      function (acc, [key, value]) {
        if (Array.isArray(value)) {
          for (const v of value) {
            acc.push(key + '=' + encodeURIComponent(v));
          }
        } else {
          acc.push(key + '=' + encodeURIComponent(value));
        }
        return acc;
      }, []
    );
    return (arr.length === 0 ? '' : '?' + arr.join('&'))
  }
}

const Rq_ = new Interface_('Request', ['url', 'oauth']);

function attachParamsToUrl_(url, key, value) {
  if (!value) return url;
  const leading = (_ => {
    if (url.indexOf('?') === -1) return '&'
    else return '?';
  })();
  return url += `${leading}${key}=${value}`;
}

class Request_ {

  /*
   * 
   * @constructor
   */
  constructor ({url=Rq_.req, oauth=Rq_.req, method='get', headers={}, body={}, params={}, ...kwargs}={}, {mixin=null}) {
    Rq_.extra(kwargs);
    this.url = url;
    this.headers = headers;
    this.body = body;
    this.method = method;
    this.params = params;
    this.params.fields = [];
    this.stickyHeaders = headers;
    this.oauth = oauth;

    if (mixin) Object.assign(this, mixin);
    return KlassProxy_(this);
  }
  
  response () {
    let resp = this.fetch();
    if (resp.hitRateLimit) {
      // try again
      resp = this.fetch();
    }
    return resp;
  }
  
  /*
   * Gather any changes on the request object made, and go
   */
  fetch () {
    const [url, obj] = this.requestObject({embedUrl: false});
    const response = (_ => {
      try {
        return UrlFetchApp.fetch(url, obj);
      } catch (e) {
        throw new Error(e, {obj, url});
      }    
    })(/* get response but catch error*/);
    
    const request = UrlFetchApp.getRequest(url, obj);
    const resp = new Response_({response, request: request});
    return resp;
  }
  
  set fields (value) {
    this.params.fields.push(value);
  }
  
  clearFields () {
    this.params.fields = [];
  }

  /*
   * Returns the param object required for UrlFetchApp.fetch or fetchAll
   * @param {bool} embedUrl if true contains url in object (for fetchAll)
   * @param {bool} muteExceptions if true errors will be returned as jsons
   * @returns [url, obj]
   */
  requestObject ({embedUrl=true, muteExceptions=true}={}) {
    const obj = {};
    
    // convert fields to a single string, and make a query on it
    // this way fields can be programmable and changed on the fly
    const url = (_ => {
      if (this.params.fields.length > 0) {
        return this.url + Requests_.utils.makeQueryString({...this.params, ...{fields: this.params.fields.join(',')}});
      }
      return this.url + Requests_.utils.makeQueryString(this.params);
    })();
    
    // we'll derive the oauth token upon request, if applicable, here
    // keep backward compatible with Oauth2 lib
    if (this.oauth) {
      const token = (_ => {
        if (this.oauth.hasAccess) {
          if (this.oauth.hasAccess()) {
            return this.oauth.getAccessToken();
          }
          return null;
        }
        return this.oauth.token || null;
      })();
      if (token==null) throw new Error("No authorization");
      this.headers['Authorization'] = `Bearer ${token}`;
    }

    obj.muteHttpExceptions = muteExceptions;
    obj.method = this.method;
    if (embedUrl) obj.url = url;
    if (this.headers) obj.headers = {...this.stickyHeaders, ...this.headers};
    else obj.headers = {...this.stickyHeaders};
    if (Object.keys(this.body).length > 0) {
      obj.payload = JSON.stringify(this.body);
      obj.contentType = 'application/json';
    }
    
    return [url, obj];
  }

  /* 
   * Actually reach out to the internet and return back the response as a json
   */
  resolve () {
    return this.fetch().json;
  }

}

const Rs_ = new Interface_('Response', ['response', 'request']);
class Response_ {
  constructor ({response=Rs_.req, request=Rs_.req, ...kwargs}={}) {
    Rs_.extra(kwargs);
    this.response = response;
    return KlassProxy_(this);
  }
  
  get text () {
    return this.response.getContentText();
  }
  
  get json () {
    const text = this.text;
    const result = (_ => {
      try {
        return JSON.parse(text);
      } catch (err) {
        Logger.log(text);
        throw new Error("Response did not return a parsable json object");
      }
    })(/* attempt to parse to json */);
    
    return result;
  }
  
  get getAllHeaders () {
    return this.response.getAllHeaders();
  }
  
  get statusCode () {
    return this.response.getResponseCode();
  }
  
  get ok () {
    return this.statusCode === 200;
  }
  
  hitRateLimit () {
    if (this.statusCode === 429) {
      const headers = this.getAllHeaders();
      let header_reset_at = headers['x-ratelimit-reset'];
      header_reset_at = header_reset_at.replace(" UTC", "+0000").replace(" ", "T");
      const reset_at = new Date(header_reset_at).getTime();
      const utf_now = new Date().getTime();
      const milliseconds = reset_at - utf_now + 10;
      if (milliseconds > 0) {
        Logger.log(`Sleeping for ${millisseconds}`);
        Utilities.sleep(milliseconds);
      }
      return true;
    }
    return false;
  }
}

const PARAMS = Symbol('params');

/*
 * Extensibly interact with Google APIs through Discovery 
 */
class Requests_ {
  constructor ({baseUrl=null, oauth=null, discovery={}}={}) {
    this.disc = null;
    this.stickyHeaders = {};
    this.query = {};
    this.baseUrl = baseUrl;
    this.oauth = oauth;
    if (Object.keys(discovery).length > 0 && Requests_.utils.validateDiscovery(discovery)) {      
      this.disc = new DiscoveryCache_();
      this.baseUrl = Requests_.utils.translateToTemplate( this.disc.getUrl(discovery) );
    }
    
    // set oauth to a basic class
    if (this.oauth === 'me') {
      class OAUTH {
        get token () {
          return ScriptApp.getOAuthToken();
        }
      }
      this.oauth = new OAUTH();
    }
    
    return KlassProxy_(this);
  }

  createRequest (method, {url=null, ...interpolations}={}, {params={}, body={}, headers={}}={}, {mixin=null}={}) {
    const options = {};
    
    // check for what it has been passed
    if (Object.keys(interpolations).length > 0) {
      if (url) throw new Error("Expecting no url parameter for interpolation: url cannot be used");
      if (!this.baseUrl) throw new Error("Expecting baseUrl for interpolation");
      Logger.log(interpolations);
      Logger.log(this.baseUrl);
      options.url = Requests_.utils.interpolate(this.baseUrl, interpolations);
    } else if (url !== null) {
      options.url = url;
    } else {
      options.url = this.baseUrl;
    }
    options.method = method;
    options.headers = {...this.stickyHeaders, ...headers};  // second overwrites
    options.body = body;
    options.params = params;
    options.oauth = this.oauth;

    return new Request_(options, {mixin});
  }
  
  get ({...kwargs}={}, {...kwargs2}={}) {
    return this.createRequest('get', kwargs, kwargs2);
  }
  
  post ({...kwargs}={}, {...kwargs2}={}) {
    return this.createRequest('post', kwargs, kwargs2);
  }
  
  put ({...kwargs}={}, {...kwargs2}={}) {
    return this.createRequest('put', kwargs, kwargs2);
  }
  
  patch ({...kwargs}={}, {...kwargs2}={}) {
    return this.createRequest('patch', kwargs, kwargs2);
  }
  
  delete_({...kwargs}={}, {...kwargs2}={}) {
    return this.createRequest('delete', kwargs, kwargs2);
  }

  static get utils () {
    return new Utils_();
  }
  
  static discovery ({name=D_.req, version=D_.req, resource=D_.req, method=D_.req, oauth="me", ...kwargs}={}) {
    D_.extra(kwargs);
    const discovery = {
      name: name,
      version: version,
      resource: resource,
      method: method
    };
    return new Requests_({oauth, discovery});
  }
  
  static oauthService ({service = S_.req, config = S_.req}) {
    const settings = new config();
    const oauthService = OAuth2.createService(service)
                      .setTokenUrl('https://accounts.google.com/o/oauth2/token')
                      .setIssuer(settings.email)
                      .setPrivateKey(settings.privateKey)
                      .setPropertyStore(PropertiesService.getUserProperties())
                      .setScope(settings.scopes);
    return oauthService;
  }  

}


/*
 * @returns class Request_ see API for documentation details
 */
function lib() {
  return Requests_;
}

function init({...kwargs}={}) {
  return new Requests_(kwargs);
}
