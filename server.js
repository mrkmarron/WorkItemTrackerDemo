
var http = require('http');
var fs = require("fs");
var process = require("process");

var htmlPageTemplate = fs.readFileSync(__dirname + "/page.html", 'utf8')
var userListTemplate = "<li id='%NAME%' onclick='getUserDetail(\"%NAME%\")' class='userListItem' data-expanded='false'><a> %NAME% </a> </li>";

var userTaskInfoTemplate = "<div class='task-summary'+%TASKTIME%>Average time available per task:  %TASKTIME% days. </div> <ul class='task-list'>%TASKS%</ul>";
var userTaskTemplate = "<li class='taskListItem'>Task is: \"%TASK%\" -- line %LINE% in %FILE%</li>";

var codeFile = __dirname + "\\sampleCode.js";
var code = fs.readFileSync(codeFile, 'utf8');

var daysLeftInSprint = 10;
var devList = ['Mark', 'Sandeep', 'Sara', 'Rob', 'Arunesh']
var todoMap = null;

//Scan our source files for TODO comments and extract the associated info into the ToDo maps
function buildToDoList() {    
    todoMap = new Map();
    for (var j = 0; j < devList.length; ++j) {
        todoMap.set(devList[j], []);
    }
    
    var arrayOfLines = code.match(/[^\r\n]+/g);

    for (var i = 0; i < arrayOfLines.length; ++i) {
        //find todo and put in the map as needed
        var lineText = arrayOfLines[i];
        var entry = lineText.match(/TODO[' ']*(\w+)[' ']*:[' ']*(.*)/);

        if (entry !== null) {
            var name = entry[1];
            var msg = entry[2];
            var line = (i + 1).toString();
            
            var entryArray = todoMap.get(name); 
            var entryObject = { "name": name, "msg": msg, "file": codeFile, "line": line };
            entryArray.push(entryObject);
        }
    }
}

//Perform the template instantiation for a single html entry and a map of patterns we want to replace
function templateItem(htmlTemplate, replaceMap) {
    var res = htmlTemplate;

    replaceMap.forEach(function (value, key) {
        //Bad values that are likely an error.
        //We don't want to abort but we should report them for later triage.
        if (value === undefined || value === NaN || value === Infinity) {
            var msg = `Potentially bad value encountered in templating -- ${value} @ timestamp ${Date.now()}.`;
            console.log(msg);
            
            //force the exit
            process.exit();
        }

        var allregex = new RegExp(key, 'g')
        res = res.replace(allregex, value);
    });

    return res;
}

//Take a html template and instatiate a new version of it for every map in our array
function templateList(htmlTemplate, arrayOfReplaceMaps) {
    var res = [];
    for (var i = 0; i < arrayOfReplaceMaps.length; ++i) {
        res.push(templateItem(htmlTemplate, arrayOfReplaceMaps[i]));
    }
    return res;
}

//Construct the reponse for the home page
function constructHomepage() {
    buildToDoList();

    var userArray = [];
    var totalTasks = 0;
    todoMap.forEach(function (value, key) {
        var userMap = new Map();
        userMap.set('%NAMETASKLIST%', '/' + key);
        userMap.set('%NAME%', key);
        userMap.set('%COUNT%', value.length + ' ' + (value.length == 1 ? 'task' : 'tasks'));
        userArray.push(userMap);

        totalTasks += value.length;
    });
    var userlist = templateList(userListTemplate, userArray);

    var pageMap = new Map();
    pageMap.set('%TOTALCOUNT%', totalTasks);
    pageMap.set('%USERLIST%', userlist.join('\n'));
    pageMap.set('%DAYS%', daysLeftInSprint + ' ' + (daysLeftInSprint == 0 ? 'day' : 'days'));
    var homepage = templateItem(htmlPageTemplate, pageMap);

    return homepage;
}

//Construct the reponse for a users task page
function constructUserInfo(userTaskArray) {
    var taskArray = [];
    userTaskArray.forEach(function (value, key) {
        var userMap = new Map();
        userMap.set('%TASK%', value.msg);
        userMap.set('%LINE%', value.line);
        userMap.set('%FILE%', value.file);
        taskArray.push(userMap);
    });
    var userlist = templateList(userTaskTemplate, taskArray);

    var infoMap = new Map();
    infoMap.set('%TASKTIME%', daysLeftInSprint / userTaskArray.length);
    infoMap.set('%TASKS%', userlist.join('\n'));
    var info = templateItem(userTaskInfoTemplate, infoMap);

    return info;
}

function respondHome(request, response) {
    var rqUrl = request.url

    if (rqUrl === "/") {
        response.writeHead(200, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
        response.write(constructHomepage());
        response.end();
    }
    else if (rqUrl === "/exit") {
        process.exit(0);
    }
    else {
        var user = rqUrl.slice(1);
        if (!todoMap.has(user)) {
            response.writeHead(200, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
            response.write('Unknown User "' + user + '".');
            response.end();
        }
        else {
            var taskArray = todoMap.get(user);
            response.writeHead(200, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
            response.write(constructUserInfo(taskArray));
            response.end();
        }
    }
}

var server = http.createServer(respondHome);
server.listen(1338);

console.log("Server running at http://127.0.0.1:1338/");
