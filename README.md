# youtube-converter
YouTube mp3 converter with frontend in Vanilla JS, CSS, HTML and backend in Node.js and Express.js.

## Usage 📄
Go to
💻 https://ytmp3-converter.herokuapp.com/  
(it may take a few seconds to load as heroku dynos go to sleep mode if unused for a while)

- Paste youtube link of desired song to the text area  
- Choose bitrate
- Click 'Convert' and wait for download button to pop up  
- Click 'Download'  
- Enjoy!  

## Features 🎉
- YouTube video to mp3 conversion
- Chooseable bitrate 64-320 kbps
- Adds thumbnail, artist and song title to mp3 meta-tags 
- Fully responsive UI
- Supports multiple requests simultaneously

## Heroku Deployment
You need to host this repo and https://github.com/KMoszczyc/yt-dlp-back for fast youtube download. Ytdl-core is now very slow when it comes to downloading (at least at the time of fixing this bug) compared to yt-dlp and
yt-dlp doesn't have a npm package, only a python one. That's why a second repo was necessary for this app to work.
So firstly:
- Deploy https://github.com/KMoszczyc/yt-dlp-back on Heroku
- Change necessary endpoints in this repo (https://github.com/KMoszczyc/youtube-converter) - (script.js and in utils.js)
- Deploy this repo
- Enjoy!

## Example usage 📷

<div align="center">
  <h3>PC</h3>
  <img src="https://user-images.githubusercontent.com/61971053/130526310-fda2fea3-57d1-4a26-87c8-8699ee659606.gif" alt="animated" />
</div>

<div align="center">
  <h3>Mobile</h3>
  <img src="https://user-images.githubusercontent.com/61971053/130527180-3d81e063-ca35-43be-9a65-92094500c9a4.gif" alt="animated" />
</div


