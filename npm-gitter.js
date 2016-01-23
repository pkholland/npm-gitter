var spawnSync = require('child_process').spawnSync;
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');

var repo_url;
var local_repo;

for (var v in process.argv) {
  var arg = process.argv[v];
  if (arg.indexOf('repo_url=') === 0)
    repo_url = arg.split('repo_url=')[1];
  else if (arg.indexOf('local_dir=') === 0)
    local_repo = arg.split('local_dir=')[1];
}


function do_assert(err, str) {
  if (err) {
    console.error(str);
    process.exit(1);
  }
}

// the required arguments
do_assert(!repo_url, 'No repo url supplied - must call with repo_url=<the url to your git repo>');
do_assert(!local_repo, 'No local directory supplied - must call with local_dir=<local directory to checkout into>');

// if there is a '#' in the repo string then the thing after it is what we are supposed to checkout to
var branch_name = 'master';
var pos = repo_url.lastIndexOf('#');
if (pos > -1) {
  branch_name = repo_url.substring(pos+1);
  repo_url = repo_url.substring(0,pos);
}

// figure out where the local repo directory is supposed to be
var parent_dir;
var repo_name;
pos = local_repo.lastIndexOf('/');
do_assert(pos > -1 && pos === local_repo.length, 'Invalid local directory name - cannot end in \'/\'');

if (pos === -1) {
  parent_dir = '.';
  repo_name = local_repo;
} else {
  repo_name = local_repo.substring(pos+1);
  if (pos === 0)
    parent_dir = '/';
  else
    parent_dir = local_repo.substring(0,pos);
}

// make sure the parent directory of the local repo directory exists
mkdirp(parent_dir,function(err) {
  do_assert(err, 'mkdirp(' + parent_dir + ') failed: ' + err);
  
  // does the local repo dir already exist?
  fs.stat(local_repo, function(error, stats) {
    if (error) {
    
      if (error.message.toString().indexOf('ENOENT') === 0) {
        // the local repo dir doesn't exist, so git clone it
        spawnSync('git', ['clone', repo_url, repo_name], { stdio: 'inherit', cwd: parent_dir });
        spawnSync('git', ['checkout', branch_name], { stdio: 'inherit', cwd: local_repo });
      } else
        do_assert(error, 'fs.stat(' + local_repo + ') failed: ' + error);
        
    } else if (stats.isDirectory()) {

      // if it is already a directory do one more quick check to see
      // if it seems to be a git directory
      var s = fs.statSync(local_repo + '/.git');
      do_assert(!stats.isDirectory(),local_repo + '/.git' + ' exists, but it not a directory');
      
      // if there are mods in this repo then we issue a note and do not update anything
      // this is essentially the "npm link" case automated
      var so = spawnSync('git', ['status', '-s'], {cwd: local_repo}).stdout.toString();
      var lines = so.split('\n');
      for (var l in lines)  {
        if (lines[l].indexOf(' M') === 0) {
          console.log(local_repo + ' has modifications - so will not be updated');
          return;
        }
      }

      spawnSync('git', ['fetch', 'origin'], { stdio: 'inherit', cwd: local_repo });
      spawnSync('git', ['checkout', branch_name], { stdio: 'inherit', cwd: local_repo });
      
      // is 'branch_name' actually a branch? if so, pull origin to it
      so = spawnSync('git', ['branch'], {cwd: local_repo}).stdout.toString();
      lines = so.split('\n');
      for (var l in lines)  {
        if (lines[l].substring(2) === branch_name) {
          spawnSync('git', ['pull', 'origin', branch_name], { stdio: 'inherit', cwd: local_repo });
          break;
        }
      }
    
    } else
      do_assert(true,local_repo + ' exists, but it not a directory');
    
  });
  
});

