// todo: keep search/browse state when closing/opening the panel

"use client";

import { useState, useEffect, useCallback } from "react";
import type { SketchfabModel } from "./types";
import { Sketchfab } from "./sketchfab-api";
import { BuTTon, ScrollTXsT, ROw } from "./ui";

// biome-ignore format: consts
const
  LOAD_FEATURED_MODELS         = false,
  DO_DISMISS_PANEL_ON_DOWNLOAD = false
;

interface SketchfabBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (modelUrl: string, fileName: string) => void;
}

export function SketchfabBrowser({ isOpen, onClose, onSelectModel }: SketchfabBrowserProps) {
  // biome-ignore format: consts
  const
    [searchQuery, setSearchQuery]       = useState(""),
    [searchResults, setSearchResults]   = useState<SketchfabModel[]>([]),
    [featuredModels, setFeaturedModels] = useState<SketchfabModel[]>([]),
    [isLoading, setIsLoading]           = useState(false),
    [error, setError]                   = useState<string | null>(null),
    [selectedModel, setSelectedModel]   = useState<SketchfabModel | null>(null),
    [cursor, setCursor]                 = useState<string | null>(null),
    [hasMore, setHasMore]               = useState(false),
    [isDownloading, setIsDownloading]   = useState(false),
    [isLoggedIn, setIsLoggedIn]         = useState(false),
    [isCheckingAuth, setIsCheckingAuth] = useState(true)
  ;

  useEffect(() => {
    if (isOpen) {
      checkAuthStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (LOAD_FEATURED_MODELS && isOpen && featuredModels.length === 0) {
      loadFeaturedModels();
    }
  }, [isOpen]);

  const checkAuthStatus = async () => {
    setIsCheckingAuth(true);
    try {
      const authenticated = await Sketchfab.isAuthenticated();
      setIsLoggedIn(authenticated);
    } catch (error) {
      console.error("Error checking authentication status:", error);
      setIsLoggedIn(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = () => {
    const loginUrl = Sketchfab.getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
    } else {
      setError("Failed to generate login URL");
    }
  };

  const loadFeaturedModels = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await Sketchfab.getFeaturedModels(24);
      if (result?.results) {
        setFeaturedModels(result.results);
      }
    } catch (error) {
      setError("Failed to load featured models");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSearchResults([]);
      setCursor(null);

      const result = await Sketchfab.searchModels(query, { downloadable: true });
      if (result?.results) {
        setSearchResults(result.results);
        setCursor(result.next || null);
        setHasMore(!!result.next);
      }
    } catch (error) {
      setError("Search failed");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    // todo: pagination seems broken
    if (!cursor || isLoading) return;

    try {
      setIsLoading(true);
      const result = await Sketchfab.searchModels(searchQuery, {
        cursor,
        downloadable: true
      });

      if (result?.results) {
        setSearchResults((prev) => [...prev, ...result.results]);
        setCursor(result.next || null);
        setHasMore(!!result.next);
      }
    } catch (error) {
      setError("Failed to load more models");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectModel = useCallback((model: SketchfabModel) => {
    setSelectedModel(model);
  }, []);

  const handleDownloadAndLoad = async () => {
    if (!selectedModel) return;
    if (!isLoggedIn) {
      setError("Please log in to download models");
      return;
    }

    try {
      setIsDownloading(true);
      setError(null);

      const downloadUrl = await Sketchfab.downloadModel(selectedModel.uid);
      if (downloadUrl) {
        onSelectModel(downloadUrl, selectedModel.name);
        if (DO_DISMISS_PANEL_ON_DOWNLOAD) onClose();
      } else {
        setError("Failed to download model");
      }
    } catch (error) {
      setError("Download failed");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const displayedModels = searchResults.length > 0 ? searchResults : featuredModels;

  return (
    <div className="sketchfab-panel-content">
      <div className="content-group">
        <div className="panel-header">
          <h3>ブラウザ SKETCHFAB</h3>

          <div className={`auth-container ${!isLoggedIn ? "animate-warning-blink" : ""}`}>
            <div
              className={`auth-hexagon ${isLoggedIn ? "logged-in" : ""}`}
              data-logged-in={isLoggedIn}
              onClick={!isLoggedIn ? handleLogin : undefined}
              title={isLoggedIn ? "Logged in to Sketchfab" : "Click to log in"}
            >
              {isCheckingAuth && <span className="auth-loading">...</span>}
              {!isCheckingAuth && (
                <span className={`auth-symbol ${!isCheckingAuth && isLoggedIn ? "logged-in" : ""}`}>ム</span>
              )}
            </div>
            <span className="auth-text">AUTH</span>
          </div>
        </div>

        <div className="status-bar">
          <div className="status-fill" />
        </div>

        <div className="search-container">
          <div className="terminal-input-wrapper">
            <span className="terminal-arrow">{">"}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH"
              className="search-input"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <BuTTon primaryText="検索" secondaryText="Search" onClick={() => handleSearch()} disabled={isLoading} />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="models-list">
          {isLoading && displayedModels.length === 0 ? (
            <div className="loading-indicator">Loading models...</div>
          ) : (
            displayedModels.map((model) => (
              <div
                key={model.uid}
                className={`model-list-item ${selectedModel?.uid === model.uid ? "selected" : ""}`}
                onClick={() => handleSelectModel(model)}
              >
                <div className="model-list-thumbnail">
                  <img src={model.thumbnails.images[0]?.url} alt={model.name} loading="lazy" />
                </div>
                <div className="model-list-info">
                  <div className="model-list-name">
                    <ScrollTXsT text={model.name} width={280} />
                  </div>
                  <div className="model-list-author">by {model.user.username || model.user.displayName}</div>
                  <div className="model-list-meta">
                    <span className="model-list-likes">{model.likeCount} ♥</span>
                    <span className="model-list-uid">UID:{model.uid.substring(0, 6)}</span>
                  </div>
                </div>
              </div>
            ))
          )}

          {searchResults.length > 0 && hasMore && (
            <div className="load-more">
              <BuTTon primaryText="もっと" secondaryText="Load More" onClick={handleLoadMore} disabled={isLoading} />
            </div>
          )}
        </div>
      </div>

      {selectedModel && (
        <div className="content-group">
          <h3>情報 MODEL</h3>
          <div className="stats-table">
            <ROw label="Name" value={<ScrollTXsT text={selectedModel.name} />} />
            <ROw label="Likes" value={selectedModel.likeCount.toString()} />
            <ROw label="Author" value={selectedModel.user.username || selectedModel.user.displayName} />
            <ROw label="Views" value={selectedModel.viewCount.toString()} />
            <ROw label="ID" value={selectedModel.uid} />
          </div>

          <div className="model-description-panel">
            <div className="description-content">{selectedModel.description || "No description available"}</div>
          </div>

          <BuTTon
            primaryText="ロード"
            secondaryText="Download & Load"
            onClick={handleDownloadAndLoad}
            disabled={isDownloading || !isLoggedIn}
            className="rojo full-width-btn"
          />
          {!isLoggedIn && <div className="forbidden upper">Login required for download</div>}
          {isDownloading && <div className="downloading-indicator">Downloading...</div>}
        </div>
      )}
    </div>
  );
}
