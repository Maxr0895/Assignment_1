class WBRApp {
  constructor() {
    this.currentPage = 1;
    this.currentMeetingId = null;
    this.eventSource = null; // SSE connection
    this.reconnectAttempts = 0;
    this.init();
  }

  init() {
    this.checkAuthState();
    this.bindEvents();
  }

  bindEvents() {
    // Health check
    document
      .getElementById("health-check-btn")
      .addEventListener("click", () => this.checkHealth());

    // Authentication tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.switchTab(e.target.dataset.tab));
    });

    // Authentication
    document
      .getElementById("login-form")
      .addEventListener("submit", (e) => this.handleLogin(e));
    document
      .getElementById("register-form")
      .addEventListener("submit", (e) => this.handleRegister(e));
    document
      .getElementById("confirm-form")
      .addEventListener("submit", (e) => this.handleConfirm(e));
    document
      .getElementById("reset-form")
      .addEventListener("submit", (e) => this.handleReset(e));
    document
      .getElementById("logout-btn")
      .addEventListener("click", () => this.logout());

    // Upload
    document
      .getElementById("upload-form")
      .addEventListener("submit", (e) => this.handleUpload(e));

    // Meetings
    document
      .getElementById("load-meetings-btn")
      .addEventListener("click", () => this.loadMeetings());
    document
      .getElementById("prev-page-btn")
      .addEventListener("click", () => this.prevPage());
    document
      .getElementById("next-page-btn")
      .addEventListener("click", () => this.nextPage());

    // Processing
    document
      .getElementById("transcode-btn")
      .addEventListener("click", () => this.transcodeVideo());
    document
      .getElementById("transcribe-btn")
      .addEventListener("click", () => this.transcribeVideo());
    document
      .getElementById("extract-actions-btn")
      .addEventListener("click", () => this.extractActions());

    // Reports
    document
      .getElementById("report-form")
      .addEventListener("submit", (e) => this.generateReport(e));
  }

  async apiFetch(url, options = {}) {
    const jwt = localStorage.getItem("jwt");
    const isFormData = options && options.body instanceof FormData;
    const headers = {
      ...(options.headers || {}),
    };

    // Only set JSON content-type if not sending FormData
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.logout();
        throw new Error("Authentication expired");
      }

      // Handle MFA required errors
      if (response.status === 403) {
        const errorData = await response.clone().json().catch(() => ({}));
        if (errorData.error === 'MFA required') {
          // Show MFA banner
          const mfaBanner = document.getElementById('mfa-warning-banner');
          if (mfaBanner) {
            mfaBanner.classList.remove('hidden');
          }
          
          // Disable admin buttons
          document.querySelectorAll('.admin-only button').forEach(btn => {
            btn.disabled = true;
            btn.title = 'MFA required - please enroll TOTP';
          });
          
          throw new Error(errorData.message || 'MFA required for this action');
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  checkAuthState() {
    const jwt = localStorage.getItem("jwt");
    const userInfoStr = localStorage.getItem("userInfo");

    if (jwt && userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        this.showAuthenticated(userInfo);
      } catch (e) {
        // Invalid userInfo, logout
        this.logout();
      }
    } else {
      this.showUnauthenticated();
    }
  }

  switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach((tab) => {
      tab.classList.add("hidden");
      tab.classList.remove("active");
    });
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.remove("hidden");
    document.getElementById(`${tabName}-tab`).classList.add("active");
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  }

  showAuthenticated(userInfo) {
    document.getElementById("auth-panel").classList.add("hidden");
    document
      .querySelectorAll(".protected-content")
      .forEach((el) => el.classList.remove("hidden"));
    
    // Display user info with role/groups
    const username = userInfo.username || userInfo;
    const isAdmin = userInfo.isAdmin || false;
    const groups = userInfo.groups || [];
    
    // ✅ WORKAROUND: Check manual MFA flag since Cognito doesn't include amr claim
    const mfaVerifiedFlag = localStorage.getItem("mfaVerified") === "true";
    const mfaSatisfied = mfaVerifiedFlag || userInfo.mfaSatisfied || false;
    const roleText = isAdmin ? 'Admin' : 'User';
    
    // DEBUG: Log MFA status
    console.log('🔐 MFA Status:', {
      isAdmin,
      mfaSatisfied,
      mfaVerifiedFlag,
      amr: userInfo.amr,
      userInfo
    });
    
    document.getElementById("user-info").textContent = `Logged in as ${username} (${roleText})`;
    document.getElementById("user-info").classList.remove("hidden");
    document.getElementById("logout-btn").classList.remove("hidden");
    
    // Show/hide admin-only controls (processing buttons only)
    const adminControls = document.querySelectorAll('.admin-only');
    adminControls.forEach(el => {
      if (isAdmin) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
    
    // Show MFA warning banner if admin but MFA not satisfied
    const mfaBanner = document.getElementById('mfa-warning-banner');
    if (isAdmin && !mfaSatisfied) {
      console.log('⚠️  MFA NOT satisfied - disabling admin buttons');
      mfaBanner.classList.remove('hidden');
      
      // Disable admin-only action buttons
      document.querySelectorAll('.admin-only button').forEach(btn => {
        btn.disabled = true;
        btn.title = 'MFA required - please enroll TOTP';
      });
    } else {
      console.log('✅ MFA satisfied - enabling admin buttons');
      mfaBanner.classList.add('hidden');
      
      // Re-enable admin buttons
      document.querySelectorAll('.admin-only button').forEach(btn => {
        btn.disabled = false;
        btn.title = '';
      });
    }
  }

  showUnauthenticated() {
    document.getElementById("auth-panel").classList.remove("hidden");
    document
      .querySelectorAll(".protected-content")
      .forEach((el) => el.classList.add("hidden"));
    document.getElementById("user-info").classList.add("hidden");
    document.getElementById("logout-btn").classList.add("hidden");
  }

  logout() {
    // Close SSE connection
    this.disconnectSSE();
    
    localStorage.removeItem("jwt");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("mfaVerified");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userInfo");
    this.showUnauthenticated();
    this.showResult("login-result", "Logged out successfully", "success");
  }

  async checkHealth() {
    try {
      const btn = document.getElementById("health-check-btn");
      this.setLoading(btn, true);

      const response = await fetch("/health");
      const data = await response.json();

      this.showResult(
        "health-result",
        `System is ${data.ok ? "healthy" : "unhealthy"}. Uptime: ${Math.floor(
          data.uptime
        )}s. OpenAI: ${data.openaiAvailable ? "available" : "not configured"}`,
        data.ok ? "success" : "error"
      );
    } catch (error) {
      this.showResult(
        "health-result",
        `Health check failed: ${error.message}`,
        "error"
      );
    } finally {
      this.setLoading(document.getElementById("health-check-btn"), false);
    }
  }

  async handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await this.apiFetch("/v1/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Check if MFA challenge is required
        console.log('🔐 Login response:', data);
        if (!data.success && data.challengeName === 'SOFTWARE_TOKEN_MFA') {
          console.log('✅ MFA challenge detected, prompting for code');
          // Prompt user for MFA code
          const mfaCode = prompt('Enter the 6-digit code from your authenticator app:');
          console.log('🔢 MFA code entered:', mfaCode ? 'Yes (6 digits)' : 'No (canceled)');
          if (!mfaCode) {
            this.showResult("login-result", "MFA code required to continue", "error");
            return;
          }
          
          console.log('📤 Sending MFA code to server...');
          // Submit MFA code
          const mfaResponse = await this.apiFetch("/v1/login", {
            method: "POST",
            body: JSON.stringify({ username, password, mfaCode, session: data.session }),
          });
          console.log('📥 MFA response received:', { ok: mfaResponse.ok, status: mfaResponse.status });
          
          if (mfaResponse.ok) {
            const mfaData = await mfaResponse.json();
            if (!mfaData.success) {
              this.showResult("login-result", "Invalid MFA code", "error");
              return;
            }
            // Continue with normal login flow
            localStorage.setItem("jwt", mfaData.idToken);
            localStorage.setItem("accessToken", mfaData.accessToken); // Store for MFA operations
            localStorage.setItem("mfaVerified", "true"); // ✅ Flag that MFA was completed
            await this.completeLogin(username);
            return;
          } else {
            const error = await mfaResponse.json();
            this.showResult("login-result", error.error || "MFA verification failed", "error");
            return;
          }
        }
        
        // Normal login (no MFA)
        if (data.success) {
          // Use idToken for API authentication (contains MFA info via 'amr' claim)
          localStorage.setItem("jwt", data.idToken);
          localStorage.setItem("accessToken", data.accessToken); // Store for MFA operations
          await this.completeLogin(username);
        } else {
          this.showResult("login-result", data.message || "Login failed", "error");
        }
      } else {
        const error = await response.json();
        this.showResult("login-result", error.error, "error");
      }
    } catch (error) {
      this.showResult(
        "login-result",
        `Login failed: ${error.message}`,
        "error"
      );
    }
  }

  async completeLogin(username) {
    try {
      // Fetch user info including groups and MFA status
      const userInfoResponse = await this.apiFetch("/v1/me");
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        localStorage.setItem("userInfo", JSON.stringify(userInfo));
        this.showAuthenticated(userInfo);
      } else {
        // Fallback if /me fails
        this.showAuthenticated({ username, isAdmin: false, groups: [], mfaSatisfied: false });
      }
      
      this.showResult("login-result", "Login successful!", "success");
    } catch (error) {
      console.error('Complete login error:', error);
      this.showAuthenticated({ username, isAdmin: false, groups: [], mfaSatisfied: false });
      this.showResult("login-result", "Login successful!", "success");
    }
  }

  async handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    try {
      const response = await fetch("/v1/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showResult("register-result", data.message, "success");
        // Pre-fill confirmation form
        document.getElementById("confirm-username").value = username;
        // Switch to confirmation tab
        setTimeout(() => this.switchTab("confirm"), 2000);
      } else {
        this.showResult("register-result", data.error, "error");
      }
    } catch (error) {
      this.showResult(
        "register-result",
        `Registration failed: ${error.message}`,
        "error"
      );
    }
  }

  async handleConfirm(e) {
    e.preventDefault();

    const username = document.getElementById("confirm-username").value;
    const code = document.getElementById("confirm-code").value;

    try {
      const response = await fetch("/v1/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showResult("confirm-result", data.message + " You can now login!", "success");
        // Switch to login tab
        setTimeout(() => this.switchTab("login"), 2000);
      } else {
        this.showResult("confirm-result", data.error, "error");
      }
    } catch (error) {
      this.showResult(
        "confirm-result",
        `Confirmation failed: ${error.message}`,
        "error"
      );
    }
  }

  async handleReset(e) {
    e.preventDefault();

    const username = document.getElementById("reset-username").value;
    const code = document.getElementById("reset-code").value;
    const newPassword = document.getElementById("reset-password").value;

    try {
      const response = await fetch("/v1/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showResult("reset-result", data.message, "success");
        // Switch to login tab
        setTimeout(() => this.switchTab("login"), 2000);
      } else {
        this.showResult("reset-result", data.error, "error");
      }
    } catch (error) {
      this.showResult(
        "reset-result",
        `Password reset failed: ${error.message}`,
        "error"
      );
    }
  }

  async handleUpload(e) {
    e.preventDefault();

    const fileInput = document.getElementById("video-file");
    const titleInput = document.getElementById("title");
    const file = fileInput.files[0];

    if (!file) {
      this.showResult("upload-result", "Please select a video file", "error");
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const progressContainer = document.getElementById("upload-progress-container");
    const progressBar = document.getElementById("upload-progress");
    const progressText = document.getElementById("upload-progress-text");

    try {
      this.setLoading(btn, true);
      progressContainer.classList.remove("hidden");
      progressBar.value = 0;
      progressText.textContent = "0%";

      // Step 1: Get presigned upload URL
      this.showResult("upload-result", "Getting upload URL...", "info");
      
      const presignResponse = await this.apiFetch("/v1/files/presign-upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream'
        })
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, key, meetingId } = await presignResponse.json();

      // Step 2: Upload file directly to S3 with progress tracking
      this.showResult("upload-result", "Uploading to S3...", "info");
      
      await this.uploadToS3WithProgress(uploadUrl, file, (progress) => {
        progressBar.value = progress;
        progressText.textContent = `${progress}%`;
      });

      // Step 3: Register the meeting with sourceKey
      this.showResult("upload-result", "Registering meeting...", "info");
      
      const registerResponse = await this.apiFetch("/v1/meetings", {
        method: "POST",
        body: JSON.stringify({
          sourceKey: key,
          title: titleInput.value || `Meeting ${new Date().toISOString().split('T')[0]}`
        })
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(error.error || "Failed to register meeting");
      }

      const data = await registerResponse.json();
      
      this.showResult(
        "upload-result",
        `Meeting created successfully! ID: ${data.meetingId}`,
        "success"
      );
      
      document.getElementById("upload-form").reset();
      progressContainer.classList.add("hidden");
      this.loadMeetings(); // Refresh meetings list
      
    } catch (error) {
      this.showResult(
        "upload-result",
        `Upload failed: ${error.message}`,
        "error"
      );
      progressContainer.classList.add("hidden");
    } finally {
      this.setLoading(btn, false);
    }
  }

  uploadToS3WithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        console.log('📥 S3 Response:', {
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText.substring(0, 200)
        });
        
        if (xhr.status === 200) {
          console.log('✅ S3 upload successful!');
          resolve();
        } else {
          console.error('❌ S3 upload failed:', {
            status: xhr.status,
            response: xhr.responseText
          });
          reject(new Error(`S3 upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', (e) => {
        console.error('❌ Network error during S3 upload:', e);
        console.error('XHR details:', {
          readyState: xhr.readyState,
          status: xhr.status,
          statusText: xhr.statusText
        });
        reject(new Error('Network error during S3 upload - check CORS configuration'));
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);
      console.log('🔑 Request headers:', { 'Content-Type': file.type });
      xhr.send(file);
    });
  }

  async loadMeetings() {
    try {
      const btn = document.getElementById("load-meetings-btn");
      this.setLoading(btn, true);

      const response = await this.apiFetch(
        `/v1/meetings?page=${this.currentPage}&limit=10`
      );
      const data = await response.json();

      this.renderMeetings(data.meetings);
      this.updatePagination(data.pagination);

      document.getElementById("meetings-result").classList.remove("hidden");
    } catch (error) {
      this.showResult(
        "meetings-result",
        `Failed to load meetings: ${error.message}`,
        "error"
      );
    } finally {
      this.setLoading(document.getElementById("load-meetings-btn"), false);
    }
  }

  renderMeetings(meetings) {
    const tbody = document.getElementById("meetings-tbody");
    tbody.innerHTML = "";

    meetings.forEach((meeting) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${meeting.title || "Untitled"}</td>
                <td><span class="status-badge status-${meeting.status}">${
        meeting.status
      }</span></td>
                <td>${new Date(meeting.created_at).toLocaleDateString()}</td>
                <td>${
                  meeting.duration_s
                    ? Math.floor(meeting.duration_s) + "s"
                    : "N/A"
                }</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="app.loadMeetingDetails('${
                      meeting.id
                    }')">
                        View Details
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteMeeting('${
                      meeting.id
                    }', '${meeting.title || "this meeting"}')">
                        Delete
                    </button>
                </td>
            `;
      tbody.appendChild(row);
    });
  }

  async loadMeetingDetails(meetingId) {
    try {
      this.currentMeetingId = meetingId;
      const response = await this.apiFetch(`/v1/meetings/${meetingId}`);
      const meeting = await response.json();

      this.renderMeetingDetails(meeting);
      
      // Start SSE connection for real-time updates
      this.connectSSE(meetingId);
    } catch (error) {
      alert(`Failed to load meeting details: ${error.message}`);
    }
  }

  renderMeetingDetails(meeting) {
    document.getElementById("meeting-title").textContent =
      meeting.title || "Untitled Meeting";
    document.getElementById("meeting-status").textContent = meeting.status;
    document.getElementById("meeting-duration").textContent = meeting.duration_s
      ? `${Math.floor(meeting.duration_s)}s`
      : "Unknown";

    // Show renditions
    if (meeting.renditions && meeting.renditions.length > 0) {
      const renditionsList = document.getElementById("renditions-list");
      renditionsList.innerHTML = meeting.renditions
        .map(
          (r) =>
            `<a href="${
              meeting.fileUrls[r.resolution]
            }" class="video-link" target="_blank">
                    ${r.resolution} (${Math.floor(
              r.size_bytes / 1024 / 1024
            )}MB)
                </a>`
        )
        .join("");
      document.getElementById("renditions-section").classList.remove("hidden");
    }

    // Show thumbnails
    if (meeting.thumbnails && meeting.thumbnails.length > 0) {
      const thumbnailsList = document.getElementById("thumbnails-list");
      thumbnailsList.innerHTML = meeting.thumbnails
        .map((thumb) => `<img src="${thumb}" alt="Thumbnail" loading="lazy">`)
        .join("");
      document.getElementById("thumbnails-section").classList.remove("hidden");
    }

    // Show captions
    if (meeting.captions) {
      const captionsLinks = document.getElementById("captions-links");
      captionsLinks.innerHTML = `
                <a href="${meeting.fileUrls.srt}" class="video-link" target="_blank">Download SRT</a>
                <a href="${meeting.fileUrls.vtt}" class="video-link" target="_blank">Download VTT</a>
            `;

      // Show transcript preview
      if (meeting.captions.segments_json) {
        const segments = JSON.parse(meeting.captions.segments_json);
        const preview = document.getElementById("transcript-preview");
        preview.innerHTML = segments
          .slice(0, 5)
          .map(
            (segment) =>
              `<div class="segment-preview">
                        <div class="segment-time">${Math.floor(
                          segment.start
                        )}s - ${Math.floor(segment.end)}s</div>
                        <div>${segment.text}</div>
                    </div>`
          )
          .join("");
      }

      document.getElementById("captions-section").classList.remove("hidden");
    }

    // Show actions
    if (meeting.actions && meeting.actions.length > 0) {
      const actionsList = document.getElementById("actions-list");
      actionsList.innerHTML = meeting.actions
        .map(
          (action) =>
            `<div class="action-item">
                    <div>${action.summary}</div>
                    <div class="action-meta">
                        ${
                          action.owner_resolved
                            ? `<span>Owner: ${action.owner_resolved}</span>`
                            : ""
                        }
                        ${
                          action.due_date
                            ? `<span>Due: ${action.due_date}</span>`
                            : ""
                        }
                        ${
                          action.priority
                            ? `<span class="priority-badge priority-${action.priority.toLowerCase()}">${
                                action.priority
                              }</span>`
                            : ""
                        }
                        <span>Time: ${Math.floor(
                          action.start_s
                        )}s - ${Math.floor(action.end_s)}s</span>
                    </div>
                </div>`
        )
        .join("");
      document.getElementById("actions-section").classList.remove("hidden");
    }

    document.getElementById("meeting-details").classList.remove("hidden");
  }

  async transcodeVideo() {
    if (!this.currentMeetingId) return;

    try {
      const btn = document.getElementById("transcode-btn");
      this.setLoading(btn, true);

      const response = await this.apiFetch(
        `/v1/meetings/${this.currentMeetingId}/transcode`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert("Transcoding completed successfully!");
        this.loadMeetingDetails(this.currentMeetingId); // Refresh details
      } else {
        const error = await response.json();
        alert(`Transcoding failed: ${error.error}`);
      }
    } catch (error) {
      this.showResult(
        "transcode-result",
        `Transcoding failed: ${error.message}`,
        "error"
      );
    } finally {
      this.setLoading(document.getElementById("transcode-btn"), false);
    }
  }

  async transcribeVideo() {
    if (!this.currentMeetingId) return;

    try {
      const btn = document.getElementById("transcribe-btn");
      this.setLoading(btn, true);

      let requestBody = {};
      let attempted = false;

      // If OpenAI is not available, prompt for manual transcript
      const healthResponse = await fetch("/health");
      const healthData = await healthResponse.json();

      if (!healthData.openaiAvailable) {
        const manualTranscript = prompt(
          "OpenAI not available. Please enter manual transcript:"
        );
        if (!manualTranscript) {
          return;
        }
        requestBody = { manualTranscript };
      }

      const doRequest = async (body) => {
        return await this.apiFetch(
          `/v1/meetings/${this.currentMeetingId}/transcribe`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );
      };

      let response = await doRequest(requestBody);

      // If OpenAI path failed, prompt for manual transcript and retry once
      if (!response.ok && !requestBody.manualTranscript && !attempted) {
        attempted = true;
        const error = await response
          .json()
          .catch(() => ({ error: "Transcription failed" }));
        const manualTranscript = prompt(
          `${
            error.error || "Transcription failed"
          }. Enter a manual transcript to continue:`
        );
        if (manualTranscript) {
          response = await doRequest({ manualTranscript });
        }
      }

      if (response.ok) {
        const data = await response.json();
        alert("Transcription completed successfully!");
        this.loadMeetingDetails(this.currentMeetingId); // Refresh details
      } else {
        const error = await response
          .json()
          .catch(() => ({ error: "Transcription failed" }));
        alert(`Transcription failed: ${error.error}`);
      }
    } catch (error) {
      alert(`Transcription failed: ${error.message}`);
    } finally {
      this.setLoading(document.getElementById("transcribe-btn"), false);
    }
  }

  async extractActions() {
    if (!this.currentMeetingId) return;

    try {
      const btn = document.getElementById("extract-actions-btn");
      this.setLoading(btn, true);

      const response = await this.apiFetch(
        `/v1/meetings/${this.currentMeetingId}/actions`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(
          `Action extraction completed! Found ${data.actions.length} action items.`
        );
        this.loadMeetingDetails(this.currentMeetingId); // Refresh details
      } else {
        const error = await response.json();
        alert(`Action extraction failed: ${error.error}`);
      }
    } catch (error) {
      alert(`Action extraction failed: ${error.message}`);
    } finally {
      this.setLoading(document.getElementById("extract-actions-btn"), false);
    }
  }

  async deleteMeeting(meetingId, title) {
    // Confirm deletion
    const confirmed = confirm(`Are you sure you want to delete "${title}"?\n\nThis action cannot be undone.`);
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await this.apiFetch(`/v1/meetings/${meetingId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Meeting deleted successfully!\n\n${data.deletedItems} items removed from database.`);
        
        // If we're viewing this meeting's details, close SSE and go back to list
        if (this.currentMeetingId === meetingId) {
          this.disconnectSSE();
          this.currentMeetingId = null;
          document.getElementById('meeting-details').classList.add('hidden');
        }
        
        // Refresh meetings list
        this.loadMeetings();
      } else {
        const error = await response.json();
        alert(`Delete failed: ${error.message || error.error}`);
      }
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  }

  // ===== Server-Sent Events (SSE) for Real-Time Updates =====

  connectSSE(meetingId) {
    // Close any existing connection
    this.disconnectSSE();

    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      console.warn('No JWT token, skipping SSE connection');
      return;
    }

    console.log(`📡 Connecting SSE for meeting ${meetingId}...`);

    // EventSource doesn't support custom headers, so we pass token as query param
    // Alternative: use fetch with ReadableStream for SSE
    const url = `/v1/meetings/${meetingId}/events?token=${encodeURIComponent(jwt)}`;
    
    // Using fetch + ReadableStream for SSE with custom headers
    this.connectSSEWithFetch(meetingId);
  }

  async connectSSEWithFetch(meetingId) {
    const jwt = localStorage.getItem('jwt');
    
    try {
      const response = await fetch(`/v1/meetings/${meetingId}/events`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'text/event-stream'
        }
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      // Hide connection banner on successful connect
      this.hideConnectionBanner();
      this.reconnectAttempts = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Read stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('📡 SSE stream ended');
              this.handleSSEDisconnect(meetingId);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ''; // Keep incomplete message in buffer

            // Process complete messages
            for (const message of lines) {
              if (message.trim()) {
                this.handleSSEMessage(message, meetingId);
              }
            }
          }
        } catch (error) {
          console.error('📡 SSE stream read error:', error);
          this.handleSSEDisconnect(meetingId);
        }
      };

      // Store reader for cleanup
      this.sseReader = reader;
      this.currentSSEMeetingId = meetingId;

      // Start processing
      processStream();

    } catch (error) {
      console.error('📡 SSE connection error:', error);
      this.handleSSEDisconnect(meetingId);
    }
  }

  handleSSEMessage(message, meetingId) {
    // Parse SSE message format: "event: eventName\ndata: {...}"
    const lines = message.split('\n');
    let event = 'message';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.substring(5).trim();
      } else if (line.startsWith(':')) {
        // Keepalive ping, ignore
        return;
      }
    }

    if (!data) return;

    try {
      const payload = JSON.parse(data);

      switch (event) {
        case 'connected':
          console.log('📡 SSE connected:', payload);
          this.hideConnectionBanner();
          break;

        case 'status':
          console.log('📡 Meeting status update:', payload);
          // Update UI with new status without full page refresh
          this.updateMeetingStatus(payload);
          break;

        case 'error':
          console.error('📡 SSE error event:', payload);
          break;

        case 'connectionLost':
          console.log('📡 Server closing connection');
          break;

        default:
          console.log('📡 Unknown SSE event:', event, payload);
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error, data);
    }
  }

  updateMeetingStatus(status) {
    // Update status badge
    const statusEl = document.getElementById('meeting-status');
    if (statusEl) {
      statusEl.textContent = status.status;
    }

    // If new data is available (renditions, captions, actions), reload details
    if (status.hasRenditions || status.hasCaptions || status.hasActions) {
      console.log('📡 New content available, reloading details...');
      // Reload full meeting details to show new renditions/captions/actions
      this.loadMeetingDetails(status.meetingId);
    }
  }

  handleSSEDisconnect(meetingId) {
    console.log('📡 SSE disconnected, showing banner and scheduling reconnect...');
    
    // Show connection banner
    this.showConnectionBanner();

    // Only reconnect if we're still viewing this meeting
    if (this.currentMeetingId === meetingId) {
      this.reconnectAttempts++;
      const retryDelay = Math.min(5000 * this.reconnectAttempts, 30000); // Max 30s
      
      console.log(`📡 Reconnecting in ${retryDelay}ms (attempt ${this.reconnectAttempts})...`);
      
      setTimeout(() => {
        if (this.currentMeetingId === meetingId) {
          // Re-sync state from API before reconnecting
          this.resyncMeetingState(meetingId);
          this.connectSSEWithFetch(meetingId);
        }
      }, retryDelay);
    }
  }

  async resyncMeetingState(meetingId) {
    console.log('📡 Re-syncing meeting state from API...');
    try {
      const response = await this.apiFetch(`/v1/meetings/${meetingId}`);
      if (response.ok) {
        const meeting = await response.json();
        this.renderMeetingDetails(meeting);
        console.log('📡 State re-synced successfully');
      }
    } catch (error) {
      console.error('Failed to re-sync state:', error);
    }
  }

  disconnectSSE() {
    if (this.sseReader) {
      console.log('📡 Closing SSE connection...');
      try {
        this.sseReader.cancel();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.sseReader = null;
      this.currentSSEMeetingId = null;
      this.reconnectAttempts = 0;
      this.hideConnectionBanner();
    }
  }

  showConnectionBanner() {
    const banner = document.getElementById('connection-banner');
    const retryCount = document.getElementById('connection-retry-count');
    
    if (banner) {
      banner.classList.remove('hidden');
      if (retryCount) {
        retryCount.textContent = `Reconnection attempt ${this.reconnectAttempts}...`;
      }
    }
  }

  hideConnectionBanner() {
    const banner = document.getElementById('connection-banner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  async generateReport(e) {
    e.preventDefault();

    try {
      const btn = e.target.querySelector('button[type="submit"]');
      this.setLoading(btn, true);

      const from = document.getElementById("report-from").value;
      const to = document.getElementById("report-to").value;
      const owner = document.getElementById("report-owner").value;

      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      if (owner) params.append("owner", owner);

      const response = await this.apiFetch(`/v1/reports/wbr-summary?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.renderReport(data.summary);
      } else {
        const error = await response.json();
        this.showResult("report-result", error.error, "error");
      }
    } catch (error) {
      this.showResult(
        "report-result",
        `Report generation failed: ${error.message}`,
        "error"
      );
    } finally {
      this.setLoading(e.target.querySelector('button[type="submit"]'), false);
    }
  }

  renderReport(summary) {
    const reportHtml = `
            <div class="report-summary">
                <h3>WBR Summary Report</h3>
                <p><strong>Total Actions:</strong> ${summary.totalActions}</p>

                <h4>By Owner:</h4>
                <table class="data-table">
                    <thead>
                        <tr><th>Owner</th><th>Count</th></tr>
                    </thead>
                    <tbody>
                        ${summary.byOwner
                          .map(
                            (item) =>
                              `<tr><td>${item.owner}</td><td>${item.count}</td></tr>`
                          )
                          .join("")}
                    </tbody>
                </table>

                <h4>By Priority:</h4>
                <table class="data-table">
                    <thead>
                        <tr><th>Priority</th><th>Count</th></tr>
                    </thead>
                    <tbody>
                        ${summary.byPriority
                          .map(
                            (item) =>
                              `<tr><td>${item.priority}</td><td>${item.count}</td></tr>`
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        `;

    this.showResult("report-result", reportHtml, "info");
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadMeetings();
    }
  }

  nextPage() {
    this.currentPage++;
    this.loadMeetings();
  }

  updatePagination(pagination) {
    document.getElementById(
      "page-info"
    ).textContent = `Page ${pagination.page}`;
    document.getElementById("prev-page-btn").disabled = pagination.page <= 1;
    document.getElementById("next-page-btn").disabled = !pagination.hasMore;
  }

  setLoading(element, loading) {
    if (loading) {
      element.classList.add("loading");
      element.disabled = true;
    } else {
      element.classList.remove("loading");
      element.disabled = false;
    }
  }

  showResult(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = message;
    element.className = `result ${type}`;
    element.classList.remove("hidden");
  }

  // ===== MFA Enrollment Methods =====

  openMFAModal() {
    document.getElementById('mfa-modal').classList.remove('hidden');
    // Reset modal state
    document.getElementById('mfa-step-1').classList.remove('hidden');
    document.getElementById('mfa-step-2').classList.add('hidden');
    document.getElementById('qr-code-image').classList.add('hidden');
    document.getElementById('secret-code-text').classList.add('hidden');
    document.getElementById('qr-code-loading').textContent = 'Click "Generate QR Code" to begin...';
    document.getElementById('mfa-code-input').value = '';
    document.getElementById('mfa-verify-result').classList.add('hidden');
  }

  closeMFAModal() {
    document.getElementById('mfa-modal').classList.add('hidden');
  }

  async generateMFAQR() {
    const btn = document.getElementById('generate-qr-btn');
    const loading = document.getElementById('qr-code-loading');
    const qrImage = document.getElementById('qr-code-image');
    const secretText = document.getElementById('secret-code-text');
    
    try {
      this.setLoading(btn, true);
      loading.textContent = 'Generating QR code...';

      // Use access token for MFA setup (not ID token)
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Access token not found. Please log in again.');
      }

      const response = await fetch('/v1/mfa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Display QR code using qrserver.com API
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qrCodeData)}`;
        qrImage.src = qrCodeUrl;
        qrImage.classList.remove('hidden');
        
        // Show secret code as backup
        secretText.textContent = `Manual Entry Code: ${data.secretCode}`;
        secretText.classList.remove('hidden');
        
        loading.textContent = '';
        btn.classList.add('hidden');
        
        // Show step 2 (code entry)
        document.getElementById('mfa-step-2').classList.remove('hidden');
      } else {
        const error = await response.json();
        loading.textContent = `Error: ${error.error}`;
        loading.style.color = 'red';
      }
    } catch (error) {
      loading.textContent = `Error: ${error.message}`;
      loading.style.color = 'red';
    } finally {
      this.setLoading(btn, false);
    }
  }

  async verifyMFACode() {
    const mfaCode = document.getElementById('mfa-code-input').value.trim();
    const resultDiv = document.getElementById('mfa-verify-result');
    
    if (!mfaCode || mfaCode.length !== 6) {
      resultDiv.textContent = 'Please enter a 6-digit code';
      resultDiv.className = 'result error';
      resultDiv.classList.remove('hidden');
      return;
    }

    try {
      resultDiv.textContent = 'Verifying code...';
      resultDiv.className = 'result info';
      resultDiv.classList.remove('hidden');

      // Use access token for MFA verify (not ID token)
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Access token not found. Please log in again.');
      }

      const response = await fetch('/v1/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ mfaCode }),
      });

      if (response.ok) {
        const data = await response.json();
        resultDiv.textContent = `${data.message} Refreshing...`;
        resultDiv.className = 'result success';
        
        // Wait 2 seconds then logout to force re-login with MFA
        setTimeout(() => {
          this.logout();
          alert('MFA enabled! Please log in again. You will now be asked for a 6-digit code from your authenticator app.');
          this.closeMFAModal();
        }, 2000);
      } else {
        const error = await response.json();
        resultDiv.textContent = error.error || 'Verification failed';
        resultDiv.className = 'result error';
      }
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      resultDiv.className = 'result error';
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new WBRApp();
});
