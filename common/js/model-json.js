/* 
 * Model for JSON data 
 */

(function(exports) {
    "use strict";

    // {Object} appSettings are the user-defined settings from the index page
    function JSONMediaModel(appSettings) {
        // mixin inheritance, initialize this as an event handler for these events:
        Events.call(this, ['error']);

        // this.mediaData = [];
        this.categoryData = []; // Holds the TV program titles (ScienceTV, NatureTV, etc...)
        this.currSubCategory = []; // Holds data in current subcategory
        this.currData = []; // Holds data in current category
        this.currentCategory = 0; // Index of current category
        this.currentItem = 0; 
        this.defaultTheme = "default";
        this.currentlySearchData = false;

        this.collectionFolder = []; //Holds all the TV program objects
        this.mediaFolder = []; //Holds responseData with seriesList and episodeList

        //timeout default to 1 min
        this.TIMEOUT = 60000;

        /**
         * This function loads the initial data needed to start the app and calls the provided callback with the data when it is fully loaded
         * @param {function} the callback function to call with the loaded data
         */
        this.loadCollections = function(dataLoadedCallback) {
            // var queue = []; // Holds the dynamic data for the ajax calls
            // for(var i = 0; i < this.count; i++) {
            //     queue.push("https://cms.xivetv.com/api/v3/collection/" + this.collectionListArray[i].collectionId);
            // }

            var queue = [ // Holds the static URL's for the ajax calls
                appSettings.collection1,
                appSettings.collection2,
                appSettings.collection3,
                appSettings.collection4,
                appSettings.collection5,
                appSettings.collection6,
                appSettings.collection7,
                appSettings.collection8
            ];

            var requests = [];
            for (var i = 0; i < queue.length; i++) { // Load the requests [] with all the ajax calls
                requests.push($.ajax({
                    url: queue[i],
                    type: 'GET',
                    crossDomain: true,
                    dataType: 'json',
                    context: this,
                    cache: true,
                    timeout: this.TIMEOUT,
                    success: function() {
                        this.handleCollections(arguments[0]);
                    }.bind(this),
                    error: function(jqXHR, textStatus) {
                        if (jqXHR.status === 0) {
                            this.trigger("error", ErrorTypes.INITIAL_NETWORK_ERROR, errorHandler.genStack());
                            return;
                        }
                        switch (textStatus) {
                            case "timeout":
                                this.trigger("error", ErrorTypes.INITIAL_FEED_TIMEOUT, errorHandler.genStack());
                                break;
                            case "parsererror":
                                this.trigger("error", ErrorTypes.INITIAL_PARSING_ERROR, errorHandler.genStack());
                                break;
                            default:
                                this.trigger("error", ErrorTypes.INITIAL_FEED_ERROR, errorHandler.genStack());
                                break;
                        }
                    }.bind(this)
                }));
            }

            var element = this;
            $.when.apply($, requests).done(function() { // Make the ajax calls
                for (var i = 0; i < element.collectionFolder.length; i++) { // Once all the calls are made, fill the left-nav with titles
                    element.categoryData[i] = element.collectionFolder[i].title;
                }
                dataLoadedCallback();
            });
        }.bind(this);

        /**
         * Handles requests that contain json data
         * @param {Object} collectionDetails data returned from request
         */
        this.handleCollections = function(collectionDetails) {
            this.insert(collectionDetails.responseData, this.comparer(), "series_collection_order", this.collectionFolder);
        }

        /***************************
         *
         * Sorting Methods
         *
         ***************************/
        /**
         * O(log(n)) Insertion Sort
         * @param {Object} element to be inserted into array
         * @param {Method} comparer function to determine placement in array
         * @param {String} key used to determine order in JSON object
         * @param {Array} array in which the elemented will be inserted 
         */
        this.insert = function(element, comparer, key, array) {
            var index = this.locationOf(element, array, comparer, key) + 1;
            array.splice(index, 0, element);
        }

        this.locationOf = function(element, array, comparer, key, start, end) {
            if (array.length === 0) return -1;
            start = start || 0;
            end = end || array.length;
            var pivot = (start + end) >> 1;
            var c = this.comparer(element[key], array[pivot][key]);
            if (end - start <= 1) return c == -1 ? pivot - 1 : pivot;

            switch (c) {
                case -1:
                    return this.locationOf(element, array, comparer, key, start, pivot);
                case 0:
                    return pivot;
                case 1:
                    return this.locationOf(element, array, comparer, key, pivot, end);
            };
        };

        this.comparer = function(a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        };

        /**
         * Sort JSON array by specific key value
         */
        this.sort_by = function(field, reverse, primer) {
            var key = primer ?
                function(x) {
                    return primer(x[field])
                } :
                function(x) {
                    return x[field]
                };
            reverse = !reverse ? 1 : -1;
            return function(a, b) {
                return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
            }
        };

        /***************************
         *
         * Category Methods
         *
         ***************************/
        /**
         * Hang onto the index of the currently selected category
         * @param {Number} index the index into the categories array
         */
        this.setCurrentCategory = function(index) {
            this.currentCategory = index;
        };

        /**
         * Function to set the current subcategory object, this be used to return the subcategory resuts in the getSubCategory method
         * which can be modified in the model before being returned asynchrounously if the model wishes.
         * @param {Object} data currently selected subcategory object
         */
        this.setCurrentSubCategory = function(data) {
            this.currSubCategory = data;
        };

        /***************************
         *
         * Content Item Methods
         *
         ***************************/
        /**
         * Return the category items for the left-nav view
         */
        this.getCategoryItems = function() {
            return this.categoryData;
        };

        /** 
         * Get and return data for a selected category
         * @param {Function} categoryCallback method to call with returned requested data
         */
        this.getCategoryData = function(categoryCallback) {
            var currCat;
            this.currData = [];

            currCat = this.collectionFolder[this.currentCategory];
            this.currData = this.getFullContentsForFolder(currCat);
            categoryCallback(this.currData);
        };

        /** 
         * Get and return full contents objects for a given folder
         * @param {object} folder object to find contents for
         */
        this.getFullContentsForFolder = function(folder) {
            var contents = [];
            if (folder.hasOwnProperty("collectionId")) { // Check if current folder is a collection
                for (var i = 0; i < folder.seriesList.length; i++) { // Add all series and episodes to content []
                    folder.seriesList[i].type = "subcategory";
                    this.insert(folder.seriesList[i], this.comparer(), "order", contents);
                }
                for (var i = 0; i < folder.episodeList.length; i++) {
                    this.insert(folder.episodeList[i], this.comparer(), "order", contents);
                }
            } else if (folder.hasOwnProperty("seriesId")) { // Check if current folder is a series
                for (var i = 0; i < folder.episodeList.length; i++) { // Add all episodes to content []
                    this.insert(folder.episodeList[i], this.comparer(), "order", contents);
                }
            }
            return contents;
            // return contents.sort(this.sort_by("order", false, parseInt));
        };

        /** 
         * Get and return data for a selected sub category, modified however the model wishes. Uses an asynchrounous callback to return the data.
         * @param {Function} subCategoryCallback method to call with returned requested data
         */
        this.getSubCategoryData = function(subCategoryCallback) {
            var returnData = JSON.parse(JSON.stringify(this.currSubCategory));
            returnData.contents = this.getFullContentsForFolder(this.currSubCategory);
            subCategoryCallback(returnData);
        };

        /**
         * Get and return data for a search term
         * @param {string} searchTerm to search for
         * @param {Function} searchCallback method to call with returned requested data
         */
        this.getDataFromSearch = function(searchTerm, searchCallback) {
            this.currData = [];
            for (var i = 0; i < this.collectionFolder.length; i++) {
                if (this.collectionFolder[i].title.toLowerCase().indexOf(searchTerm) >= 0 ||
                    this.collectionFolder[i].uniqueDescription.toLowerCase().indexOf(searchTerm) >= 0) {
                    this.currData.push(this.collectionFolder[i]);
                }
            }
            for (var i = 0; i < this.seriesFolder.length; i++) {
                if (this.seriesFolder[i].title.toLowerCase().indexOf(searchTerm) >= 0 ||
                    this.seriesFolder[i].uniqueDescription.toLowerCase().indexOf(searchTerm) >= 0) {
                    this.currData.push(this.collectionFolder[i]);
                }
            }
            for (var i = 0; i < this.mediaFolder.length; i++) {
                if (this.mediaFolder[i].title.toLowerCase().indexOf(searchTerm) >= 0 ||
                    this.mediaFolder[i].uniqueDescription.toLowerCase().indexOf(searchTerm) >= 0) {
                    this.currData.push(this.collectionFolder[i]);
                }
            }
            searchCallback(this.currData);
        };

        /**
         * Store the refrerence to the currently selected content item
         * @param {Number} index the index of the selected item
         */
        this.setCurrentItem = function(index) {
            this.currentItem = index;
            this.currentItemData = this.currData[index];
        };

        /**
         * Retrieve the reference to the currently selected content item
         */
        this.getCurrentItemData = function() {
            return this.currentItemData;
        };

    }

    exports.JSONMediaModel = JSONMediaModel;

})(window);