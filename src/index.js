import fs from 'fs';
import axios from 'axios';
import download from 'download';

const concat = list => Array.prototype.concat.bind(list);
const promiseConcat = f => x => f().then(concat(x));
const promiseReduce = (acc, x) => acc.then(promiseConcat(x));
const serial = funcs => funcs.reduce(promiseReduce, Promise.resolve([]));

// https://vine.co/api/users/profiles/vanity/${ username }
function getUserIdByUsername(username) {
  return new Promise(resolve => {
    axios.get(`https://vine.co/api/users/profiles/vanity/${ username }`)
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

// https://archive.vine.co/profiles/${ userId }.json
function getUserData(userId) {
  return new Promise(resolve => {
    axios.get(`https://archive.vine.co/profiles/${ userId }.json`)
      .then(response => {
        //
        const data = response.data;
        // const userId = json.data.userId;

        resolve(data);
      })
      .catch(error => {
        console.error(`Error while extracting user #${ userId } data`, error);
      });
  });
}

// https://archive.vine.co/posts/${ postId }.json
function getPostData(postId) {
  return new Promise(resolve => {
    axios.get(`https://archive.vine.co/posts/${ postId }.json`)
      .then(response => {
        const data = response.data;
        // const userId = json.data.userId;

        resolve(data);
      })
      .catch(error => {
        console.error(`Error while extracting post #${ postId } data`, error);
      });
  });
}

function getFilenameFromPostData(data) {
  const date = new Date(data.created);
  const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDate()];
  const [hour, minutes] = [date.getHours(), date.getMinutes()];

  // 2015/05/27, 08:48 | Description | loops: 43, likes: 0, reposts: 0, comments: 0, id: idInPermalink
  let filename = `${ year }-${ month }-${ day }, ${ hour }-${ minutes }, `;

  if (data.description) {
    filename += data.description + ', ';
  }

  if (data.loops) {
    filename += `loops ${ data.loops }, `;
  }

  if (data.likes) {
    filename += `likes ${ data.likes }, `;
  }

  if (data.reposts) {
    filename += `reposts ${ data.reposts }, `;
  }

  if (data.comments) {
    filename += `comments ${ data.comments }, `;
  }

  filename += `id ${ new URL(data.permalinkUrl).pathname.split('/')[2] }`;
  filename = filename.replace(/[/\\?%*:|"<>]/g, '-');
  filename += '.mp4';

  return filename;
}

const dirName = 'vine-archive';

if (!fs.existsSync(dirName)){
  fs.mkdirSync(dirName);
}

const username = process.argv[2];

if (!username) {
  console.error('No username, please type username as first agrument.');

  process.exit();
}

console.log('Getting user id from username...');
const userId = await getUserIdByUsername(username);

console.log('Getting user data...');
const userData = await getUserData(userId);

console.log('Saving user data in user-data.json...');
fs.writeFileSync(`./${ dirName }/user-data.json`, JSON.stringify(userData, null, 2));

console.log('Getting all posts data...');
const posts = await Promise.all(userData.posts.map(postId => {
  return getPostData(postId);
}));

console.log('Saving user data in posts-data.json...');
fs.writeFileSync(`./${ dirName }/posts-data.json`, JSON.stringify(posts, null, 2));

const promises = posts.map((post, index) => () => {
  const filename = getFilenameFromPostData(post);
  const url = post.videoLowURL; // for some reason videoURL sometimes has broken videos and low are always ok

  console.log(`${ index + 1 }/${ posts.length } Downloads ${ filename } to ./${ dirName }...`);

  return download(url, './' + dirName, { filename });
});

serial(promises).then(() => console.log('Vine archive downloading complete.'));
