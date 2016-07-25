
// dependencies
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
    var _pxSmall = event.size_small;
    var _pxThumbnail = event.size_thumbnail;

    var _small = {
        width: _pxSmall,
        destinationPath: "small"
    };
    var _thumbnail = {
        width: _pxThumbnail,
        destinationPath: "thumbnail"
    };
    var _sizesArray = [_thumbnail, _small];
    var len = _sizesArray.length;
    // Infer the image type.
    var typeMatch = filename.match(/\.([^.]*)$/);
    // var fileName = path.basename(srcKey);
    if (!typeMatch) {
        console.error('unable to infer image type for file ' + filename);
        return;
    }
    var imageType = typeMatch[1].toLowerCase();
    if (imageType != "jpg" && imageType != "gif" && imageType != "png" &&
        imageType != "eps") {
        console.log('skipping non-image ' + srcKey);
        return;
    }
    // Transform, and upload to same S3 bucket but to a different S3 bucket.
    async.forEachOf(_sizesArray, function(value, key, callback) {
        async.waterfall([

            function download(next) {
                console.time("downloadImage");
                console.log("download");
                s3.getObject({
                    Bucket: bucket,
                    Key: mediaId + '/' + filename
                }, next);
                console.timeEnd("downloadImage");
            },
            function process(response, next) {
                console.log("process image");
                console.time("processImage");
                // Transform the image buffer in memory.
                //gm(response.Body).size(function(err, size) {
                gm(response.Body).size(function(err, size) {
                    //console.log("buf content type " + buf.ContentType);
                    // Infer the scaling factor to avoid stretching the image unnaturally.
                    console.log("run " + key +
                        " size array: " +
                        _sizesArray[key].width);
                    console.log("run " + key +
                        " size : " + size);
                    console.log(err);
                    var scalingFactor = Math.min(
                        _sizesArray[key].width /
                        size.width, _sizesArray[
                            key].width / size.height
                    );
                    console.log("run " + key +
                        " scalingFactor : " +
                        scalingFactor);
                    var width = scalingFactor *
                        size.width;
                    var height = scalingFactor *
                        size.height;
                    console.log("run " + key +
                        " width : " + width);
                    console.log("run " + key +
                        " height : " + height);
                    var index = key;
                    //this.resize({width: width, height: height, format: 'jpg',})
                    this.resize(width, height).toBuffer(
                        imageType.toUpperCase(), function(err,
                            buffer) {
                            if (err) {
                                //next(err);
                                next(err);
                            } else {
                                console.timeEnd(
                                    "processImage"
                                );
                                next(null,
                                    buffer,
                                    key);
                                //next(null, 'done');
                            }
                        });
                });
            },
            function upload(data, index, next) {
                console.time("uploadImage");
                console.log("upload : " + index);
                // console.log(_sizesArray[
                //         index].destinationPath +
                //     "/" + fileName.slice(0, -4) +
                //     ".jpg");
                // Stream the transformed image to a different folder.
                console.log('upload to key: ' + mediaId + '/' + _sizesArray[index].destinationPath + "/" + filename);
                s3.putObject({
                    Bucket: bucket,
                    Key: mediaId + '/' + _sizesArray[
                            index].destinationPath +
                        "/" + filename,
                    Body: data,
                    ContentType: imageType.toUpperCase()
                }, next);
                console.timeEnd("uploadImage");
            }
        ], function(err, result) {
            if (err) {
                console.error(err);
            }
            // result now equals 'done'
            console.log("End of step " + key);
            callback();
        });
    }, function(err) {
        if (err) {
            console.error('---->Unable to resize ' + bucket +
                '/' + filename + ' and upload to ' + mediaId + "/.../" + filename +
                ' due to an error: ' + err);
        } else {
            console.log('---->Successfully resized ' + bucket +
                ' and uploaded to' + mediaId + "/.../" + filename);
        }
        context.done();
    });
};
