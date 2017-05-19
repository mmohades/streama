//= wrapped

angular.module('streama')
  .controller('modalCreateFromFileCtrl', modalCreateFromFileCtrl);

function modalCreateFromFileCtrl($scope, $uibModalInstance, apiService, uploadService, dialogOptions, modalService, $state) {
  var vm = this;
	vm.loading = false;
	vm.localFilesEnabled = false;
	vm.localFiles = [];
	vm.localDir = [];
	vm.video = null;
	vm.mediaType = dialogOptions.mediaType;
	vm.uploadStatus = {};
	vm.hasMatcherResult = false;

	vm.loadLocalFiles = loadLocalFiles;
	vm.backLocalDirectory = backLocalDirectory;
	vm.openLocalDirectory = openLocalDirectory;
	vm.close = close;
	vm.toggleSelectAll = toggleSelectAll;
	vm.runMatcher = runMatcher;
	vm.toggleSelection = toggleSelection;
	vm.toggleDirectorySelection = toggleDirectorySelection;
	vm.getMatchForPath = getMatchForPath;
	vm.selection = [];
  vm.addAllMatches = addAllMatches;
  vm.addSelectedFile = addSelectedFile;
  vm.openMediaDetail = openMediaDetail;
  vm.openAdminForm = openAdminForm;
  vm.isSelected = isSelected;


	init();


	function init() {
		loadLocalFiles('');
	}

	function openAdminForm(mediaObject) {
		var url = $state.href('admin.' + mediaObject.importedType, {showId: mediaObject.importedId, movieId: mediaObject.importedId});
		window.open(url,'_blank');
	}

	function openMediaDetail(mediaObject) {
		modalService.mediaDetailModal({
			mediaObject: mediaObject,
			isApiMovie: true,
			mediaType: mediaObject.type
		});
	}

	function loadLocalFiles(path) {
		apiService.file.localFiles(path).success(function(data) {
			vm.localFilesEnabled = true;
			vm.localFiles = data;
		}).error(function(data) {
			if (data.code == 'LocalFilesNotEnabled') {
				vm.localFilesEnabled = false;
			}
			alertify.error(data.message);
		});
	}

	function backLocalDirectory() {
		vm.localFiles = [];
		vm.localDir.pop();
		vm.loadLocalFiles(vm.localDir.join('/'));
	}

	function openLocalDirectory(dir, forceOpen, onSuccess) {
		// vm.localFiles = [];
		// vm.localDir.push(dir.name);
		// vm.loadLocalFiles(vm.localDir.join('/'));
    dir.showFiles = (dir.showFiles == true && !forceOpen) ? false : true;
    if(!dir.localFiles || !dir.localFiles.length){
			dir.localFiles = [];
			apiService.file.localFiles(dir.path).success(function(data) {
				dir.localFiles = data;
				(onSuccess || angular.noop)(data);
			});
			console.log(dir);
		}else{
			(onSuccess || angular.noop)(dir.localFiles);
		}

	}

	function addExternalUrl(externalUrl) {
		apiService.video.addExternalUrl({id: vm.video.id, externalUrl: externalUrl}).success(function (data) {
			alertify.success("External URL Added.");
			vm.video.externalLink = null;

			if(_.find(vm.video.files, {id: data.id})){
				vm.video.files[_.indexOf(vm.video.files, {id: data.id})] = data;
			}else{
				vm.video.files = vm.video.files || [];
				vm.video.files.push(data);
				vm.video.hasFiles = true;
			}
		});
	}

	function addLocalFile(localFile) {
		apiService.video.addLocalFile({id: vm.video.id, localFile: localFile}).success(function (data) {
			alertify.success("Local File Added.");
			vm.video.localFile = null;

			if(_.find(vm.video.files, {id: data.id})){
				vm.video.files[_.indexOf(vm.video.files, {id: data.id})] = data;
			}else{
				vm.video.files = vm.video.files || [];
				vm.video.files.push(data);
				vm.video.hasFiles = true;
			}
		}).error(function(data) {
			alertify.error(data.message);
		});
	}

	function close() {
		$uibModalInstance.close();
	}

	function removeFile(file) {
		alertify.set({ buttonReverse: true, labels: {ok: "Yes", cancel : "Cancel"}});
		alertify.confirm('Are you sure you want to remove the file "'+file.originalFilename+'"?', function (confirmed) {
			if(confirmed){
				apiService.video.removeFile(vm.video.id, file.id).success(function () {
					if(file.extension == '.srt' || file.extension == '.vtt'){
						_.remove(vm.video.subtitles, {id: file.id});
						alertify.success('Subtitles deleted.');
					}else{
						_.remove(vm.video.files, {id: file.id});
						alertify.success('Video deleted.');
					}
				});
			}
		});
	}



	function getFilesForExtensions(extensions){
		return _.filter(vm.video.files, function (file) {
			return (extensions.indexOf(file.extension.toLowerCase()) > -1);
		})
	}


	function toggleSelectAll() {
		alert('toggleSelectAll needs implementation.')
	}

	function runMatcher() {
		vm.isMatcherLoading = true;
		var fileSelection = _.filter(vm.selection, {directory: false});
		apiService.file.matchMetaDataFromFiles(fileSelection).success(function (data) {
			vm.isMatcherLoading = false;
			vm.matchResult = data;
			//console.log(data);
		});
	}

	function toggleSelection(file) {
		vm.selection = _.xorBy(vm.selection, [file], 'path');
	}

	function isSelected(file) {
		return _.some(vm.selection, {path: file.path});
	}

	function toggleDirectorySelection(directory) {
		console.log('%c toggleDirectorySelection', 'color: deeppink; font-weight: bold; text-shadow: 0 0 5px deeppink;');
		openLocalDirectory(directory, true, function () {
			_.forEach(directory.localFiles, function (file) {
				toggleSelection(file);
			});
		});

	}

	function getMatchForPath(path) {
		return _.find(vm.matchResult, {file: path});
	}

  function addAllMatches() {
		var allFoundMatches = _.filter(vm.matchResult, {status: 1});
		if(allFoundMatches.length == 0){
			alertify.success('Nothing to add.');
		}
		_.each(allFoundMatches, function(fileMatch) {
			addSelectedMatch(fileMatch);
    });
  }

	function addSelectedFile(file) {
    var fileMatch = _.find(vm.matchResult, {"file": file.path});
		addSelectedMatch(fileMatch);
	}

	function addSelectedMatch(fileMatch) {
		if (fileMatch.type == "movie") {
			addMovie(fileMatch);
		} else if (fileMatch.type == "tv" || fileMatch.type == "episode") {
			addEpisodeToShow(fileMatch);
		}
		fileMatch.status = 2; //added
	}

  function addMovie(fileMatch) {
    apiService.movie.save(fileMatch).success(function (data) {
			fileMatch.importedId = data.id;
      apiService.video.addLocalFile({id: data.id, localFile: fileMatch.file}).success(function (data) {
				fileMatch.importedType = 'movie';
        alertify.success(fileMatch.title + " has been added");
      });
		});
  }

  function addEpisodeToShow(fileMatch) {
    apiService.tvShow.list().success(function (data) {
      var targetShow;

      _.each(data, function (show) {
        if(show.apiId == fileMatch.tvShowApiId) {
          targetShow = show;
        }
      });

      if(targetShow) {
        addEpisode(targetShow, fileMatch);
      } else {
        addShow(fileMatch);
      }
    });
  }

  function addShow(fileMatch) {
    var targetShow = {};
    targetShow.apiId = fileMatch.tvShowApiId;
    targetShow.name = fileMatch.showName;
    targetShow.overview = fileMatch.tvShowOverview;
    targetShow.poster_path = fileMatch.poster_path;
    targetShow.backdrop_path = fileMatch.backdrop_path;

    apiService.tvShow.save(targetShow).success(function (data) {
			fileMatch.importedId = data.id;
			fileMatch.importedType = 'show';
      addEpisode(data, fileMatch);
    });
  }

  function addEpisode(targetShow, fileMatch) {
    var episode = {};
    episode.show = targetShow.id;
    episode.apiId = fileMatch.episodeApiId;
    episode.episode_number = fileMatch.episodeNumber;
    episode.season_number = fileMatch.season;
    episode.name = fileMatch.episodeName;
    episode.overview = fileMatch.episodeOverview;
    episode.still_path = fileMatch.still_path;
		fileMatch.importedId = targetShow.id;
		fileMatch.importedType = 'show';
    apiService.episode.save(episode).success(function (data) {
      apiService.video.addLocalFile({id: data.id, localFile: fileMatch.file}).success(function (data) {
        alertify.success(fileMatch.episodeName + " has been added");
      });
    });
  }

}
