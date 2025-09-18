const GITHUB_TOKEN =""

function githubToApiUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  raw = raw.trim();

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();

    if (host === "api.github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const reposIndex = parts.indexOf("repos");
      if (reposIndex !== -1 && parts.length >= reposIndex + 3) {
        return `https://api.github.com/repos/${parts[reposIndex + 1]}/${parts[reposIndex + 2].replace(/\.git$/, "")}`;
      }
    }

    if (host === "github.com" || host === "www.github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://api.github.com/repos/${parts[0]}/${parts[1].replace(/\.git$/, "")}`;
      }
    }
  } catch (e) {
    
  }


  let m = raw.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (m) return `https://api.github.com/repos/${m[1]}/${m[2]}`;


  m = raw.match(/^([^/]+)\/([^/]+)(?:\.git)?$/);
  if (m) return `https://api.github.com/repos/${m[1]}/${m[2]}`;

  return null;
}

function extractUrlFromEntry(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  return entry.html_url || entry.url || entry.repo || entry.link || "";
}


function updateProgress(curr, total, txt = "") {
  const progress = document.getElementById("progress-bar");
  const label = document.getElementById("progress-label");

  progress.value = curr;
  progress.max = total;
  label.textContent = `Progress: ${curr} / ${total}` + (txt ? ` (${txt})` : "");
}


async function checkLinkAlive(link, savedStars) {
  try {
    const res = await fetch(link, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) return { ok: false, url: link, status: res.status };

    const data = await res.json();
    return {
      ok: true,
      url: data.html_url,
      name: data.full_name,
      stars: data.stargazers_count,
      deltaStars: data.stargazers_count - (savedStars || 0),
    };
  } catch (e) {
    return { ok: false, url: link, status: "fetch_error" };
  }
}


async function downloadAndCheck() {
  const select = document.getElementById("file-selector");
  const file = select.value;

  const resp = await fetch("data/" + file);
  const json = await resp.json();

  const links = json.map((entry) => {
    const raw = extractUrlFromEntry(entry);
    const api = githubToApiUrl(raw);
    return {
      rawUrl: raw,
      apiUrl: api,
      savedStars: entry.stars || entry.stargazers_count || 0,
      description: entry.description || "",
    };
  });

  const total = links.length;
  let done = 0;
  updateProgress(0, total, "start");

  const output = document.getElementById("output");
  output.innerHTML = "";

  const promises = links.map(async (l) => {
    const result = await checkLinkAlive(l.apiUrl, l.savedStars);
    done++;
    updateProgress(done, total);

    let line = "";
    if (result.ok) {
      const delta = result.deltaStars >= 0 ? `+${result.deltaStars}` : `${result.deltaStars}`;
      line = `OK (${delta}⭐): <a href="${result.url}" target="_blank">${l.description || result.name}</a>`;
    } else {
      line = `KO: <a href="${l.rawUrl}" target="_blank">${l.rawUrl}</a>`;
    }

    const div = document.createElement("div");
    div.innerHTML = line;
    output.appendChild(div);
  });

  await Promise.all(promises);
  updateProgress(total, total, "done!");
}

document.getElementById("start").addEventListener("click", downloadAndCheck);