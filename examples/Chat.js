/**
 * Illustrates a real functioning class (used in production) that builds upon Request.gs features
 * to create an abstract class which can be used to interact effectively with Google APIs
 * For example, on a form submission, create a new thread in a chat room
 *
 * @author Adam Morris https://classroomtechtools.com classroomtechtools.ctt@gmail.com  
 * @lastmodified 11 April 2020
 * @version 1.0 Adam Morris: Production head
 * @library TBD
 */
 

const API = Symbol('discovery_api');
const RESOURCE = Symbol('resource');  


class APIBase {    
  constructor (service) {
    this.service = service;
  }
  
  get [RESOURCE] () {
    throw new Error("Not implemented: [RESOURCE]");
  }
  
  [API] (method) {
    return Requests.discovery({name: 'chat', version: 'v1', resource: this[RESOURCE], method}, {oauth: this.service});
  }
}


class Spaces extends APIBase {
  get [RESOURCE] () {
    return 'spaces';
  }
  
  list () {
    return this[API]('list').createRequest('get');
  }
  
  get (name) {
    return this[API]('get').createRequest('get', {name});
  }
}


class Members extends APIBase {
  get [RESOURCE] () {
    return 'spaces.members';
  }
  
  get () {
    return this[API]('get').createRequest('get');
  }
  
  list (parent) {
    return this[API]('list').createRequest('get', {parent});
  }
}


class Messages extends APIBase {
  get [RESOURCE] () {
    return 'spaces.messages';
  }

  create ({parent=null, text=""}={}, kwargs={}) {
    if (!parent) throw new Error("Requires parent");
    if (text.length > 0) {
      // we have a simple message with just text
      return this[API]('create').createRequest('post', {parent}, {
        body: {text}
      });
    }    
    // we have something more elaborate
    return this[API]('create').createRequest('post', {parent}, {
      body: kwargs
    });
  }
  
  delete ({name=null}={}) {
    if (!name) throw new Error("Requires name");
    return this[API]('delete').createRequest('delete', {name});
  }
  
  get ({name=null}={}) {
    if (!name) throw new Error("Requires name");
    return this[API]('get').createRequest('get', {name});
  }
  
  update ({name=null, updateMask=null}={}, {body={}}={}) {
    if (!name || !updateMask) throw new Error("Requires message_name and updateMask");
    return this[API]('update').createRequest('put', {name}, {
      params: {updateMask},
      body
    });
  }
}


class MyConfig  {
  get privateKey () {
    return PRIVATEKEY;
  }
  
  get email () {
    return ISSUEREMAIL;
  }
  
  get scopes () {
    return ['https://www.googleapis.com/auth/chat.bot']
  }
}


class Chatv1 {
  constructor (service) {
    this.service = service;
  }
  
  static fromKeys () {
    const service = this.getService();
    return this.withService(service);
  }
  
  static getService () {
    return Requests.oauthService({service: 'MyChatService', config: MyConfig});
  }
  
  static withService (service) {
    return new Chatv1(service);
  }
  
  get spaces () {
    return new Spaces(this.service);
  }
  
  get members () {
    return new Members(this.service);
  }
  
  get messages () {
    return new Messages(this.service);
  }
}
