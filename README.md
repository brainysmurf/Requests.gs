# Requests.gs

## Illustration by example

```js
/*
 * The lowest level functionality
 * 
 */
function lowest_level() {
  // Object that represents endpoint of sheets v4 get function (notice the ${} pattern)
  // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/get
  const sheetsGetEndpoint = Requests.init({baseUrl: "https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}", oauth: "me"});
    
  // request object for endpoint, which is a "get" request and substitues <id> for spreadsheetId
  const request = sheetsGetEndpoint.get({spreadsheetId: '1PFbLiKXm0NhAOklDB46fXbukKNKxHkN_h3AlRde8Diw'});
  
  // it includes the necessary authorization headers
  Logger.log(request.headers);
  
  // reach out to the internet, returns response object
  const response = request.fetch();
  
  // Check for non 200 status
  if (!response.ok) throw new Error("Oh no!");
  
  // Parse the response's content as json, which includes lots of information about the spreadsheet
  let json = response.json;
  
  // Output the title of the spreadsheet
  Logger.log(json.properties.title);
  
  // Lets do that again, but this time in the response just get properties.title (more performant)
  // we'll modify the request query parameters
  request.fields = 'properties.title'; 
  
  // this fetches and gets json in one call
  json = request.resolve()
  
  // outputs {properties={title=Name}}
  Logger.log(json);  
}

function up_one_level() {

  // let's abstract away some of the boilerplate from above 
  // since we're writing less code let's try and do a bit more
  const Req = Requests.lib();  // access to the static methods available on the class
  
  // let's use the discovery service to derive our sheets.get endpoint (same as above)
  // notice no oauth passed, as default value is oauth: 'me' as above
  const endpoint = Req.discovery({name: 'sheets', version: 'v4', resource: 'spreadsheets', method: 'get'});
  
  // so at that endpoint we need a get request, we can get the spreadsheet title and the values in the ranges
  const method = endpoint.get({spreadsheetId: '1PFbLiKXm0NhAOklDB46fXbukKNKxHkN_h3AlRde8Diw'}, {
    params: {
      ranges: ['Sheet1!A2:B4', 'Sheet1!A1:B1'],
    }
  });
  
  // optional, but we can limit what is returned to make the roundtrips faster
  method.fields = 'properties.title';
  method.fields = 'sheets.data';
  
  // fetch and parse the json
  const json = method.resolve();
  Logger.log(json);
}


function services () {

  // okay, but what about google apis beyond what can be turned on in advanced google services?
  // let's use chat api, because why not?
  
  // first, have to install google oauth2 library for this to work.
  
  // then write the following class
  class MyConfig  {
    get privateKey () {
      return PRIVATEKEY;  // from the service account json
    }
    
    get email () {
      return ISSUEREMAIL;  // from the service account json
    }
    
    get scopes () {
      return ['https://www.googleapis.com/auth/chat.bot'];  // as required 
    }
  }
  
  const Req = Requests.lib();
  
  // this will use OAuth2.createService to return service
  // pass it your class above
  const service = Req.oauthService({service: 'MyChatServiceName', config: MyConfig});
  
  // now pass this service object on to discovery
  // https://developers.google.com/hangouts/chat/reference/rest/v1/spaces/get
  const endpoint = Requests.discovery({name: 'chat', version: 'v1', resource: 'spaces', method: 'get'}, {
    oauth: this.service
  });
  
  const json = endpoint.get({name: 'spaces/<name>'}).resolve();
  
  // outputs success response
  Logger.log(json);;
}


function library () {

  // All of the above functionality allows us to write abstract classes:
  
  const chat = Chat();  // uses above code to make service, saves state
  
  // could make methods on the class that interacts with API endpoint
  // under the hood, this just makes a request object based on parameters sent to it
  chat.createMessage({
    parent: "spaces/<name>",
    text: "This is a new chat message",
  });

}
```
