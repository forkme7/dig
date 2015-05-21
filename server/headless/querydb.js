'use strict';
// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var config = require('../config/environment');
var models = require('../models');
var assert = require('assert');
var elasticsearch = require('elasticsearch');
var ejs = require('elastic.js');
var _ = require('lodash');
var client = new elasticsearch.Client({
    host: config.euiServerUrl + ':' + config.euiServerPort, log:'info'});

// TODO: direct elasticsearch logging to injected logger
// TODO: unit test


exports = module.exports = function(logger) {
    // get a collection of all SSQs given the frequency
    // Only SSQs that do not already have a notification are returned
    var findSSQ = function(period) {
        return models.Query.findAll({
            where: {
                notificationHasRun: true,
                frequency: period
            }
        })
    }

    var getEsQuery = function(ssq) {
        var esQuery = {};

        var elasticUIState = JSON.parse(ssq.elasticUIState);
        logger.info(elasticUIState);

        if (Object.keys(elasticUIState.queryState).length > 0) {
            esQuery.query = {};
            esQuery.query.query_string = elasticUIState.queryState.query_string;        
        }

        esQuery.fields = ["_timestamp"];
        esQuery.sort = {'_timestamp': {'order': 'desc'}};
        esQuery.size = 1;

        if (Object.keys(elasticUIState.filterState).length > 0) {
            esQuery.filter = ssq.filterState;
        }

        logger.info(esQuery);
        return esQuery;
    }


    // TODO: refactor and unit test
    // given a SSQ: 
    // 1. run the ES query on the elasticsearch index sorted newest first
    // 3. compare most recent result with last run date
    // 4. if new results are available, add a notification
    var runSSQ = function(findSSQ) {
        return function() {
            models.Query.sync()
            .then (findSSQ)
            .then (function (queries) {
                queries.forEach(function(query) {
                    var results = {};

                    // query elasticsearch for new records since the last run date
                    client.search({
                        index: 'mockads',
                        type: 'ad',
                        body: getEsQuery(query)
                    })
                    .then(function (resp) {
                        
                        logger.info(resp);
                        results = resp;
                        var latestResultDate = new Date(results.hits.hits[0].fields._timestamp);
                        var diff = latestResultDate - query.lastRunDate;
                        
                        logger.info('lastRunDate: %s', query.lastRunDate);
                        if (diff > 0) {
                            query.notificationDateTime = new Date();
                            query.notificationHasRun = false;
                            query.save({fields: ['notificationDateTime', 'notificationHasRun']})
                            .then(function() {
                                
                                logger.info('updated %s', query.name);
                            })
                        }
                    }, function (err) {
                        logger.info(err.message);
                    });
                });   
            })
            .catch(function (err) {
                
                logger.info (err);
            });         
        }
    }

    var hourlySSQ = function () { return findSSQ('hourly'); }
    var dailySSQ = function() { return findSSQ('daily'); }
    var weeklySSQ = function() { return findSSQ('weekly'); }

    return {
        runHourlySSQ: runSSQ (hourlySSQ),
        runDailySSQ: runSSQ (dailySSQ),
        runWeeklySSQ: runSSQ (weeklySSQ),
    }
}
