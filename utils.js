const extractAudio = require('ffmpeg-extract-audio');
const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1.js');
const fs = require('fs');
const lodash = require('lodash');

var extractedText = '';
var keywords = '';
var log = require('log');
var chalk = require('chalk');
var Spinner = require('cli-spinner').Spinner;
var spinner = new Spinner('processing..%s');
spinner.setSpinnerString('|/-\\');

var convertVideoToAudio = async function(input_file, output_file) {
  log.info(`Converting video with Input file path: ${input_file}`);
  log.info(`Converting video with Input file path: ${output_file}`);
  spinner.start();
  try {
    const extractedValue = await extractAudio({
      input: input_file,
      output: output_file,
    }).catch(function(error) {
      spinner.stop(true);
      log.error(
        chalk.red(
          `Error trying to extract audio from video. Details: ${error.message}`
        )
      );
    });
    spinner.stop(true);
    log.info(chalk.green('==> Successfully extracted audio.'));
  } catch (error) {
    spinner.stop(true);
    log.error(
      chalk.red(
        `Error trying to convert video to audio. Details: ${error.message}`
      )
    );
  }
};

var convertAudioToText = function(url, api_key, input_file, output_file) {
  log.info('Converting audio to text with:');
  log.info(`==> url: ${url}`);
  log.info(`==> api_key: ${api_key}`);
  log.info(`==> Input file: ${input_file}`);
  log.info(`==> Output file: ${output_file}`);
  const speechToText = new SpeechToTextV1({
    iam_apikey: api_key,
    url: url,
    headers: {
      'X-Watson-Learning-Opt-Out': 'true',
    },
  });

  var params = {
    objectMode: true,
    content_type: 'audio/mp3',
    model: 'en-US_BroadbandModel',
  };
  // Create the stream.
  log.info('Creating stream...');
  spinner.start();
  var recognizeStream = speechToText.recognizeUsingWebSocket(params);
  spinner.stop(true);

  // Pipe in the audio.
  log.info('Piping in the audio...');
  spinner.start();
  fs.createReadStream(input_file).pipe(recognizeStream);

  // Listen for events.
  recognizeStream.on('data', function(event) {
    onEvent('Data:', event);
  });
  recognizeStream.on('error', function(event) {
    onEvent('Error:', event);
  });
  recognizeStream.on('close', function(event) {
    onEvent('Close:', event);
  });

  // Display events on the console.
  function onEvent(name, event) {
    if (name === 'Data:') {
      lodash.forEach(event['results'], function(results) {
        lodash.forEach(results['alternatives'], function(value) {
          extractedText += value['transcript'];
        });
      });
      spinner.stop(true);
      log.info(chalk.green(`==> Text extracted Successfully`));
    } else if (name === 'Close:') {
      log.info(`Writing extracted text into Outfile file: ${output_file}`);
      fs.writeFile(output_file, extractedText, err => {
        if (err) {
          spinner.stop(true);
          log.error(
            chalk.red(
              `Error trying to create new file in system directory. Details: ${err.message}`
            )
          );
          return;
        }
        spinner.stop(true);
        log.info(
          chalk.green(
            '==> Successfully written extracted text into Output file.'
          )
        );
      });
    } else if (name === 'Error:') {
      spinner.stop(true);
      log.error(
        chalk.red(`Error while extracting text from audio. Please try again.`)
      );
    }
    //console.log(name, JSON.stringify(event, null, 2));
  }
};

var textAnalysis = function(url, api_key, input_file, output_file) {
  const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
    version: '2018-11-16',
    iam_apikey: api_key,
    url: url,
  });
  log.info('Reading contents of Input file...');
  spinner.start();
  var text = fs.readFileSync(input_file).toString('utf8');
  spinner.stop(true);

  const analyzeParams = {
    text: text,
    features: {
      keywords: {
        sentiment: false,
        emotion: false,
        limit: 50,
      },
    },
  };

  naturalLanguageUnderstanding
    .analyze(analyzeParams)
    .then(analysisResults => {
      lodash.forEach(analysisResults['keywords'], function(value) {
        keywords += value['text'] + ',';
      });
      log.info(
        'Text Analysis complete. Now writing the file to the Output file.'
      );
      spinner.start();
      fs.writeFile(output_file, keywords, err => {
        if (err) {
          spinner.stop(true);
          log.error(
            chalk.red(
              `Error trying to create new file in system directory. Details: ${err.message}`
            )
          );
          return;
        }
        spinner.stop(true);
        log.info(
          chalk.green(
            '==> Successfully written analyzed text file into Output file.'
          )
        );
      });
      //console.log(JSON.stringify(analysisResults, null, 2));
    })
    .catch(err => {
      spinner.stop(true);
      log.error(
        chalk.red(`Error trying to analyze text. Details: ${err.message}`)
      );
    });
};

module.exports = {
  convertVideoToAudio: convertVideoToAudio,
  convertAudioToText: convertAudioToText,
  textAnalysis: textAnalysis,
};
