/*
 * A program to resize an image in an AWS S3 bucket.
 * Written in Node.js, this program accepts an array of image sizes in the payload.
 * The image is then resized to the specified width(s) and stored in a new directory.
 *
 * Author: David MacCormick
 * Date: June 2016
 */

var async = require('async');
var path = require('path');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({
    imageMagick: true
});
var util = require('util');

// get reference to S3 client
var s3 = new AWS.S3();

exports.handler = function(event, context) {

    // payload data
    var mediaId = event.media_id;
    var filename = event.file_name;
    var bucket = event.bucket;
    var sizesArray = event.sizesArray;

    if(!sizesArray) {
      /*
       * If sizesArray is not specified in the payload, then use
       * this as the default:
       */
      sizesArray = [{
          width: 50, // sets the width of the resized image to 50px
          dirName: 'thumbnail' // this is the folder name where the resized image will be stored
      }];
    }

    var len = sizesArray.length;

    // Get the image type
    var typeMatch = filename.match(/\.([^.]*)$/);
    if (!typeMatch) {
        console.error('unable to infer image type for file ' + filename);
        return;
    }

    // make sure the image is a jpg or png
    var type = typeMatch[1].toLowerCase();
    if (type != "jpg" && type != "png") {
        console.log('Image is not the right format: ' + srcKey);
        return;
    }

    // Upload resized image to same location in the S3 bucket but within a new directory
    async.forEachOf(sizesArray, function(value, key, callback) {
        async.waterfall([
            function download(next) {
                console.log("downloading image");

                // download the image from the S3 bucket
                s3.getObject({
                    Bucket: bucket,
                    Key: mediaId + '/' + filename
                }, next);
            },
            function process(response, next) {
                console.log("processing image");

                // Transform the image
                gm(response.Body).size(function(err, size) {
                    console.log(err);

                    // Calculate the scaling factor so that the resized image has the same width/height ratio
                    var scalingFactor = Math.min(
                        sizesArray[key].width / size.width, sizesArray[key].width / size.height
                    );
                    var width = scalingFactor * size.width;
                    var height = scalingFactor * size.height;
                    var index = key;
                    this.resize(width, height).toBuffer(
                      type.toUpperCase(), function(err, buffer) {
                        if (err) {
                            next(err);
                        } else {
                            next(null, buffer, key);
                        }
                    });
                });
            },
            function upload(data, index, next) {
                console.log("uploading resized image " + index);

                // Place the resized image in the same bucket location, but in a different folder
                console.log('uploading to this location: ' + mediaId + '/' + sizesArray[index].dirName + "/" + filename);
                s3.putObject({
                    Bucket: bucket,
                    Key: mediaId + '/' + sizesArray[index].dirName + "/" + filename,
                    Body: data,
                    ContentType: type.toUpperCase()
                }, next);
            }
        ], function(err, result) {
            if (err) {
                console.error(err);
            }
            callback();
        });
    }, function(err) {
        if (err) {
            console.log('Error uploading image');
            console.error(err);
        } else {
            console.log('Successfully resized image');
        }
        context.done();
    });
};

