class WBRApp {
  constructor() {
    this.currentPage = 1;
    this.currentMeetingId = null;
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

    // Authentication
    document
      .getElementById("login-form")
      .addEventListener("submit", (e) => this.handleLogin(e));
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

      return response;
    } catch (error) {
      throw error;
    }
  }

  checkAuthState() {
    const jwt = localStorage.getItem("jwt");
    const userRole = localStorage.getItem("userRole");

    if (jwt && userRole) {
      this.showAuthenticated(userRole);
    } else {
      this.showUnauthenticated();
    }
  }

  showAuthenticated(role) {
    document.getElementById("login-panel").classList.add("hidden");
    document
      .querySelectorAll(".protected-content")
      .forEach((el) => el.classList.remove("hidden"));
    document.getElementById("user-info").textContent = `Logged in as ${role}`;
    document.getElementById("user-info").classList.remove("hidden");
    document.getElementById("logout-btn").classList.remove("hidden");
  }

  showUnauthenticated() {
    document.getElementById("login-panel").classList.remove("hidden");
    document
      .querySelectorAll(".protected-content")
      .forEach((el) => el.classList.add("hidden"));
    document.getElementById("user-info").classList.add("hidden");
    document.getElementById("logout-btn").classList.add("hidden");
  }

  logout() {
    localStorage.removeItem("jwt");
    localStorage.removeItem("userRole");
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

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await this.apiFetch("/v1/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("jwt", data.token);
        localStorage.setItem("userRole", data.role);
        this.showAuthenticated(data.role);
        this.showResult("login-result", "Login successful!", "success");
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

  async handleUpload(e) {
    e.preventDefault();

    const formData = new FormData();
    const fileInput = document.getElementById("video-file");
    const titleInput = document.getElementById("title");

    if (!fileInput.files[0]) {
      this.showResult("upload-result", "Please select a video file", "error");
      return;
    }

    formData.append("file", fileInput.files[0]);
    if (titleInput.value) {
      formData.append("title", titleInput.value);
    }

    try {
      const btn = e.target.querySelector('button[type="submit"]');
      this.setLoading(btn, true);

      const response = await this.apiFetch("/v1/meetings", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        this.showResult(
          "upload-result",
          `Meeting created successfully! ID: ${data.meetingId}`,
          "success"
        );
        document.getElementById("upload-form").reset();
        this.loadMeetings(); // Refresh meetings list
      } else {
        const error = await response.json();
        this.showResult("upload-result", error.error, "error");
      }
    } catch (error) {
      this.showResult(
        "upload-result",
        `Upload failed: ${error.message}`,
        "error"
      );
    } finally {
      this.setLoading(e.target.querySelector('button[type="submit"]'), false);
    }
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
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new WBRApp();
});
