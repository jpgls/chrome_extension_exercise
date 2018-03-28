function checkProjectExists(){
    try {
      return makeRequest("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    } catch (errorMessage) {
      document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
      document.getElementById('status').hidden = false;
    }
  }
  
  function makeRequest(url, responseType) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();
      req.open('GET', url);
      req.responseType = responseType;
      
      req.onload = function() {
        var response = responseType ? req.response : req.responseXML;
        if(response && response.errorMessages && response.errorMessages.length > 0){
          reject(response.errorMessages[0]);
          return;
        }
        resolve(response);
      };
      
      // Handle network errors
      req.onerror = function() {
        reject(Error("Network Error"));
      };
      req.onreadystatechange = function() { 
        if(req.readyState == 4 && req.status == 401) { 
          reject("You must be logged in to JIRA to see this project.");
        }
      };
      
      // Make the request
      req.send();
    });
  }
  
  function loadOptions(){
    chrome.storage.sync.get({
      project: 'Sunshine',
      user: 'nyx.linden'
    }, function(items) {
      document.getElementById('project').value = items.project;
      document.getElementById('user').value = items.user;
    });
  }
  
  /**
   * Ticket Status Query Related
   */
  function buildJQL(callback) {
    var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
    var project = document.getElementById("project").value;
    var status = document.getElementById("statusSelect").value;
    var inStatusFor = document.getElementById("daysPast").value;
    var fullCallbackUrl = callbackBase;
    fullCallbackUrl += `project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
    callback(fullCallbackUrl);
  }
  
  /**
   * @param {string} searchTerm - Search term for JIRA Query.
   * @param {function(string)} callback - Called when the query results have been  
   *   formatted for rendering.
   * @param {function(string)} errorCallback - Called when the query or call fails.
   */
  async function getQueryResults(searchTerm, callback, errorCallback) {
    try {
      var response = await makeRequest(searchTerm, "json");
      callback(createHTMLElementResult(response));
    } catch (error) {
      errorCallback(error);
    }
  }
  
  /**
   * Jira Activity Query Related
   */
  function getJIRAFeed(callback, errorCallback){
    var user = document.getElementById("user").value;
    if(user == undefined) return;
    
    var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+"+user+"&providers=issues";
    makeRequest(url, "").then(function(response) {
      // empty response type allows the request.responseXML property to be returned in the makeRequest call
      callback(url, response);
    }, errorCallback);
  }
  
  function createHTMLElementResult(response){
    const issues = response.issues;
    const markupTotal = `<p>${issues.length} results found.</p>`; 
    const markupIssues = [];

    for (let issue of issues) {
      const markupTableRow = `
          <td>
            <a href="${issue.self}" target="_blank">
              ${issue.key}
            </a>
          </td>
          <td>${issue.fields.summary}</td>
          <td>${issue.fields.status.name}</td>
      `;
      markupIssues.push(markupTableRow);
    };

    const markupTable  =  `
    <table class="u-full-width table-results">
      <thead>
        <tr>
          <th class="table-issue">Issue</th>
          <th class="table-summary">Summary</th>
          <th class="table-status>Status</th>
        </tr>
      </thead>
      <tbody>
        ${markupIssues.map(issueRow => `
            <tr>${issueRow}</tr>
        `).join('')}
      </tbody>
    </table>
    `;

    const markup = `
      ${markupTotal}
      ${markupTable}
    `;

    return markup;
  }
  
  // utility 
  function domify(str){
    var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
    return dom.body.textContent;
  }
  
  // Setup
  document.addEventListener('DOMContentLoaded', function() {
    // if logged in, setup listeners
    checkProjectExists().then(function() {
      //load saved options
      loadOptions();

      // query click handler
      document.getElementById("query").onclick = function(){
        // build query
        buildJQL(function(url) {
          document.getElementById('status').innerHTML = 'Performing JIRA search for ' + url;
          document.getElementById('status').hidden = false;  
          // perform the search
          getQueryResults(url, function(return_val) {
            // render the results
            document.getElementById('status').innerHTML = 'Query term: ' + url + '\n';
            document.getElementById('status').hidden = false;
            
            var jsonResultDiv = document.getElementById('query-result');
            jsonResultDiv.innerHTML = return_val;
            jsonResultDiv.hidden = false;

          }, function(errorMessage) {
              document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
              document.getElementById('status').hidden = false;
          });
        });
      }

      // activity feed click handler
      document.getElementById("feed").onclick = function(){   
        // get the xml feed
        getJIRAFeed(function(url, xmlDoc) {
          document.getElementById('status').innerHTML = 'Activity query: ' + url + '\n';
          document.getElementById('status').hidden = false;

          // render result
          var feed = xmlDoc.getElementsByTagName('feed');
          var entries = feed[0].getElementsByTagName("entry");
          var list = document.createElement('ul');

          for (var index = 0; index < entries.length; index++) {
            var html = entries[index].getElementsByTagName("title")[0].innerHTML;
            var updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
            var item = document.createElement('li');
            item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
            list.appendChild(item);
          }

          var feedResultDiv = document.getElementById('query-result');
          if(list.childNodes.length > 0){
            feedResultDiv.innerHTML = list.outerHTML;
          } else {
            document.getElementById('status').innerHTML = 'There are no activity results.';
            document.getElementById('status').hidden = false;
          }
          
          feedResultDiv.hidden = false;

        }, function(errorMessage) {
          document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
          document.getElementById('status').hidden = false;
        });    
      };        

    }).catch(function(errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
    });   
});
