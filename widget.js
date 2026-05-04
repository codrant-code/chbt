(function () {
  console.log("🤖 Chatbot Widget v2 Loaded");

  const SUPABASE_URL = "https://nwldvgafmyaagmyezena.supabase.co";
  const SUPABASE_KEY = "sb_publishable_gWMY1sQRn3fqip0JfAQPRQ_F79rlYyZ";

  // =========================
  // CUSTOMER ID
  // =========================
  function getCustomerId() {
    let id = localStorage.getItem("cw_customer_id");

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("cw_customer_id", id);
    }

    return id;
  }

  const customer_id = getCustomerId();

  // =========================
  // LOAD SUPABASE
  // =========================
  async function loadSupabase() {
    if (window.supabase) return;

    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@supabase/supabase-js@2";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    await loadSupabase();

    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let debounceTimer;

    // =========================
    // STYLES
    // =========================
    const style = document.createElement("style");
    style.innerHTML = `
      #cw-icon {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #007bff;
        color: #fff;
        padding: 14px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 9999;
        font-size: 20px;
      }

      #cw-box {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 320px;
        height: 420px;
        background: #fff;
        border-radius: 12px;
        border: 1px solid #ddd;
        display: none;
        flex-direction: column;
        z-index: 9999;
        font-family: Arial;
        overflow: hidden;
      }

      #cw-header {
        padding: 10px;
        color: #fff;
        font-weight: bold;
      }

      #cw-messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }

      .cw-msg {
        margin: 6px 0;
        padding: 6px 10px;
        border-radius: 8px;
        max-width: 80%;
      }

      .cw-user {
        background: #e6f0ff;
        margin-left: auto;
        text-align: right;
      }

      .cw-bot {
        background: #f1f1f1;
        margin-right: auto;
      }

      #cw-input {
        display: flex;
        border-top: 1px solid #ccc;
        position: relative;
      }

      #cw-input input {
        flex: 1;
        padding: 10px;
        border: none;
        outline: none;
      }

      #cw-input button {
        padding: 10px;
        border: none;
        color: #fff;
        cursor: pointer;
      }

      #cw-suggestions {
        position: absolute;
        bottom: 50px;
        left: 0;
        right: 0;
        max-height: 160px;
        overflow-y: auto;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 10px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.15);
        display: none;
        z-index: 10000;
      }

      .cw-suggestion {
        padding: 8px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        font-size: 14px;
      }

      .cw-suggestion:hover {
        background: #f5f5f5;
      }
    `;
    document.head.appendChild(style);

    // =========================
    // UI
    // =========================
    const icon = document.createElement("div");
    icon.id = "cw-icon";
    icon.innerText = "🤖";

    const box = document.createElement("div");
    box.id = "cw-box";

    box.innerHTML = `
      <div id="cw-header">Assistant</div>
      <div id="cw-messages"></div>

      <div id="cw-input">
        <div id="cw-suggestions"></div>
        <input type="text" placeholder="Ask something..." />
        <button>Send</button>
      </div>
    `;

    document.body.appendChild(icon);
    document.body.appendChild(box);

    icon.onclick = () => {
      box.style.display = box.style.display === "flex" ? "none" : "flex";
    };

    const input = box.querySelector("input");
    const button = box.querySelector("button");
    const messages = box.querySelector("#cw-messages");
    const suggestionsBox = box.querySelector("#cw-suggestions");
    const header = box.querySelector("#cw-header");

    function addMessage(text, type) {
      const div = document.createElement("div");
      div.className = `cw-msg ${type}`;
      div.innerText = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function hideSuggestions() {
      suggestionsBox.innerHTML = "";
      suggestionsBox.style.display = "none";
    }

    function renderSuggestions(data) {
      suggestionsBox.innerHTML = "";

      data.forEach((item) => {
        const div = document.createElement("div");
        div.className = "cw-suggestion";
        div.innerText = item.question;

        div.onclick = () => {
          input.value = item.question;
          hideSuggestions();
        };

        suggestionsBox.appendChild(div);
      });

      suggestionsBox.style.display = "block";
    }

    // =========================
    // 🔥 FAQ SUGGESTIONS (DB ONLY FIXED)
    // =========================
    async function fetchSuggestions(keyword) {
      const clean = keyword.trim();

      if (!clean) {
        hideSuggestions();
        return;
      }

      console.log("Searching DB for:", clean);

      let { data, error } = await sb
        .from("faq_questions")
        .select("question")
        .eq("customer_id", customer_id)
        .ilike("question", `${clean}%`)
        .limit(8);

      if (error) {
        console.error("FAQ error:", error);
        hideSuggestions();
        return;
      }

      // fallback search if prefix fails
      if (!data || data.length === 0) {
        const res = await sb
          .from("faq_questions")
          .select("question")
          .eq("customer_id", customer_id)
          .ilike("question", `%${clean}%`)
          .limit(8);

        data = res.data;
      }

      if (!data || data.length === 0) {
        hideSuggestions();
        return;
      }

      renderSuggestions(data);
    }

    // =========================
    // SEND MESSAGE
    // =========================
    async function sendMessage() {
      const question = input.value.trim();
      if (!question) return;

      addMessage(question, "cw-user");
      input.value = "";
      hideSuggestions();

      const { data } = await sb
        .from("faq_questions")
        .select("answer")
        .eq("customer_id", customer_id)
        .ilike("question", `%${question}%`)
        .limit(1);

      if (data?.length) {
        addMessage(data[0].answer, "cw-bot");
      } else {
        addMessage("Sorry, I don't know that.", "cw-bot");
      }
    }

    // =========================
    // EVENTS
    // =========================
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        fetchSuggestions(input.value);
      }, 200);
    });

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    button.onclick = sendMessage;

    // =========================
    // THEME FROM DB (FIXED)
    // =========================
    const { data: themeData } = await sb
      .from("chatbot_signups")
      .select("theme_color")
      .eq("customer_id", customer_id)
      .single();

    if (themeData?.theme_color) {
      icon.style.background = themeData.theme_color;
      header.style.background = themeData.theme_color;
      button.style.background = themeData.theme_color;
    }
  }

  init();
})();
