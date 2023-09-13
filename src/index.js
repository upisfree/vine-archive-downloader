import fs from 'fs';
import axios from 'axios';
import download from 'download';

const concat = list => Array.prototype.concat.bind(list);
const promiseConcat = f => x => f().then(concat(x));
const promiseReduce = (acc, x) => acc.then(promiseConcat(x));
const serial = funcs => funcs.reduce(promiseReduce, Promise.resolve([]));

// https://vine.co/api/users/profiles/vanity/${username}
function getUserIdByUsername(username) {
  return new Promise(resolve => {
    axios.get(`https://vine.co/api/users/profiles/vanity/${username}`)
      .then(response => {
        const data = response.data;
        const userId = data.data.userIdStr;
        resolve(userId);
     })
      .catch(error => {
        console.error('Error while extracting user id from username', error);
     });
 });
}

// https://archive.vine.co/profiles/${userId}.json
function getUserData(userId) {
  return new Promise(resolve => {
    axios.get(`https://archive.vine.co/profiles/${userId}.json`)
      .then(response => {
        const data = response.data;
        resolve(data);
     })
      .catch(error => {
        console.error(`Error while extracting user #${userId} data`, error);
     });
 });
}

// https://archive.vine.co/posts/${postId}.json
function getPostData(postId) {
  let postMetadataURL = `https://archive.vine.co/posts/${postId}.json`
  return new Promise(resolve => {
    axios.get(postMetadataURL)
      .then(response => {
        const data = response.data;
        resolve(data);
     })
      .catch(error => {
        console.error(`
          Failed to fetch metadata for ${postMetadataURL}
          Post is likely missing/deleted and will be skipped.
        `);
        resolve(null);
     });
 });
}

// Post Metadata: 2015/05/27, 08:48 | Description | loops: 43, likes: 0, reposts: 0, comments: 0, id: idInPermalink
function getFilenameFromPostData(data) {
  let date = data.created.substring(0,10);
  let description = data.description != '' ? data.description : 'null'
  let videoID = data.permalinkUrl.substring(18)

  let filename = `${date} - ${description} - ${videoID}.mp4`
  filename = filename.replace(/[/\\?%*:|"<>]/g, '-');

  return filename;
}

const username = process.argv[2];

if (!username) {
  console.error('No username, please type username as first agrument.');

  process.exit();
}

const dirName = username;

if (!fs.existsSync(dirName)){
  fs.mkdirSync(dirName);
}

console.log('Getting user id from username...');
const userId = await getUserIdByUsername(username);

console.log('Getting user data...');
const userData = await getUserData(userId);

console.log('Saving user data in user-data.json...');
fs.writeFileSync(`./${dirName}/user-data.json`, JSON.stringify(userData, null, 2));

console.log('Getting all posts data...');
let allPosts = await Promise.all(userData.posts.map(postId => {
  return getPostData(postId);
}));

let posts = allPosts.filter(x => x !== null);

console.log(`Saving user data in ${dirName}/posts-data.json...`);
fs.writeFileSync(`./${dirName}/posts-data.json`, JSON.stringify(posts, null, 2));

const promises = posts.map((post, index) => () => {
  let filename = getFilenameFromPostData(post);
  let url = post.videoUrl;

  console.log(`${index + 1}/${posts.length} Downloads ${filename} to ./${dirName}...`);
  return download(url, './' + dirName, { filename });
});

serial(promises).then(() => console.log('Vine archive downloading complete.'));