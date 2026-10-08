// ============================================================
// app.js —— 整个程序的"大脑"，负责：取数据、画卡片、切换动画
// 这段先放"配置"和"天气代码翻译表"
// ============================================================

// Open-Meteo 的两个服务地址（存成常量，后面直接用名字引用，不用每次写一长串）
// const 表示"常量"：定了就不改。好比写死在便签上的电话号码。
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search"; // 地名→坐标 的服务
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";      // 坐标→天气 的服务

// ---- 天气代码翻译表 ----
// Open-Meteo 返回的天气是一个数字代码（WMO标准），比如 0=晴、61=雨。
// 下面这个"对象"就像一本字典：输入代码，查出 {类型, 中文名, 图标}。
// 类型(type) 会用来决定放哪种动画；中文名(label)用来显示；图标(icon)是emoji。
const WEATHER_MAP = {
  0:  { type: "clear",   label: "晴",       icon: "☀️" },  // 晴朗无云
  1:  { type: "clear",   label: "晴间多云", icon: "🌤️" }, // 基本是晴
  2:  { type: "cloudy",  label: "多云",     icon: "⛅" },  // 多云
  3:  { type: "cloudy",  label: "阴",       icon: "☁️" },  // 阴天
  45: { type: "fog",     label: "雾",       icon: "🌫️" }, // 有雾
  48: { type: "fog",     label: "霜雾",     icon: "🌫️" }, // 霜雾
  51: { type: "rain",    label: "小毛雨",   icon: "🌦️" }, // 毛毛雨(弱)
  53: { type: "rain",    label: "毛毛雨",   icon: "🌦️" }, // 毛毛雨(中)
  55: { type: "rain",    label: "浓毛毛雨", icon: "🌧️" }, // 毛毛雨(强)
  61: { type: "rain",    label: "小雨",     icon: "🌧️" }, // 小雨
  63: { type: "rain",    label: "中雨",     icon: "🌧️" }, // 中雨
  65: { type: "rain",    label: "大雨",     icon: "🌧️" }, // 大雨
  66: { type: "rain",    label: "冻雨",     icon: "🌧️" }, // 冻雨(弱)
  67: { type: "rain",    label: "强冻雨",   icon: "🌧️" }, // 冻雨(强)
  71: { type: "snow",    label: "小雪",     icon: "🌨️" }, // 小雪
  73: { type: "snow",    label: "中雪",     icon: "🌨️" }, // 中雪
  75: { type: "snow",    label: "大雪",     icon: "❄️" },  // 大雪
  77: { type: "snow",    label: "雪粒",     icon: "🌨️" }, // 雪粒
  80: { type: "rain",    label: "阵雨",     icon: "🌦️" }, // 阵雨(弱)
  81: { type: "rain",    label: "阵雨",     icon: "🌧️" }, // 阵雨(中)
  82: { type: "rain",    label: "强阵雨",   icon: "🌧️" }, // 阵雨(强)
  85: { type: "snow",    label: "阵雪",     icon: "🌨️" }, // 阵雪(弱)
  86: { type: "snow",    label: "强阵雪",   icon: "❄️" },  // 阵雪(强)
  95: { type: "thunder", label: "雷阵雨",   icon: "⛈️" }, // 雷暴
  96: { type: "thunder", label: "雷暴伴冰雹", icon: "⛈️" }, // 雷暴带冰雹(弱)
  99: { type: "thunder", label: "强雷暴冰雹", icon: "⛈️" }, // 雷暴带冰雹(强)
};

// 小工具函数：输入天气代码，返回对应的 {type,label,icon}
// 如果代码不在表里（极少见），就返回一个默认的"多云"，保证程序不出错。
function decodeWeather(code) {
  // WEATHER_MAP[code] 就是查字典；|| 表示"如果查不到就用后面这个默认值"
  return WEATHER_MAP[code] || { type: "cloudy", label: "未知", icon: "☁️" };
}

// ============================================================
// 第2段：去网上取数据
// 关键概念：从网上要数据是"要等"的（网络有延迟），不是瞬间完成。
// async/await 就是用来优雅地"等"：
//   - async 标在函数前，表示"这函数里有需要等的事"
//   - await 标在要等的那行前，表示"等它拿到结果再往下走"
// 好比点外卖：下单后要"等"骑手送到(await)，送到了才能继续吃。
// ============================================================

// 函数1：根据城市名查坐标（经纬度）。async 表示里面有要等的网络请求。
async function fetchCoords(cityName) {
  // 拼出完整网址：在地名服务后面带上参数 name=城市名、count=1(只要最匹配的1个)、language=zh(中文)
  // encodeURIComponent 把中文/特殊符号转成网址能安全传输的格式（防止"上海"这种字出错）
  const url = `${GEO_API}?name=${encodeURIComponent(cityName)}&count=1&language=zh`;

  // await fetch(url)：发出请求并"等"服务器回应。fetch 是浏览器自带的"取数据"工具。
  const response = await fetch(url);
  // .json()：把服务器返回的原始文本解析成我们能用的数据对象，这步也要等
  const data = await response.json();

  // 如果 results 不存在，或长度为0，说明没查到这个城市，就"抛出"一个错误（交给调用处处理）
  if (!data.results || data.results.length === 0) {
    throw new Error("找不到这个城市，换个名字试试");
  }

  // 取出第一个结果（最匹配的那个城市）
  const place = data.results[0];
  // 返回我们需要的三样：纬度、经度、显示用的完整地名
  return {
    lat: place.latitude,                                   // 纬度
    lon: place.longitude,                                  // 经度
    name: place.name + (place.admin1 ? "，" + place.admin1 : ""), // 名字，如"北京，北京市"
  };
}

// 函数2：根据坐标查未来7天天气。
async function fetchWeather(lat, lon) {
  // 拼网址：告诉服务器要哪些"每日数据(daily)"，以及用摄氏度、公里/小时、时区自动
  // daily 里点名要：天气代码、最高温、最低温、降水概率、最大风速、日出、日落、紫外线
  const daily = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max";
  const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&daily=${daily}&timezone=auto&forecast_days=7`;

  const response = await fetch(url); // 发请求并等回应
  const data = await response.json(); // 解析成数据对象
  return data.daily; // 只把"每日数据"那部分返回出去
}

// ============================================================
// 第3段：把数据"画"到页面上
// 概念：document.getElementById("名字") = 按门牌号找到页面上那个元素
// 找到后，改它的 .innerHTML（里面的内容）或 .textContent（纯文字），页面就变了。
// ============================================================

// 先按门牌号把要用的页面元素都找出来，存成变量，后面反复用
const cityInput    = document.getElementById("city-input");    // 输入框
const searchBtn    = document.getElementById("search-btn");    // 搜索按钮
const locateBtn    = document.getElementById("locate-btn");    // 定位按钮
const messageBox   = document.getElementById("message");       // 消息提示区
const currentCard  = document.getElementById("current-card");  // 大卡片
const forecastTitle= document.getElementById("forecast-title");// "未来7天"标题
const forecastList = document.getElementById("forecast-list"); // 7天列表容器
const animLayer    = document.getElementById("animation-layer");// 动画层

// 用两个变量"记住"当前查到的数据和城市名，供点击切换时使用
let currentDaily = null;  // 存放当前城市的7天数据
let currentCity  = "";    // 存放当前城市名

// 小工具：把日期"2026-10-08"转成"周三 10/08"这种好看的格式
function formatDate(dateStr) {
  const d = new Date(dateStr);                          // 把文本日期变成日期对象
  const weeks = ["周日","周一","周二","周三","周四","周五","周六"]; // 星期对照表
  const w = weeks[d.getDay()];                          // getDay()返回0-6，查出中文星期
  const md = (d.getMonth() + 1) + "/" + d.getDate();    // 月份要+1(JS里月份从0算)，拼成"10/8"
  return w + " " + md;                                  // 拼成"周三 10/8"
}

// 显示提示文字（加载中/出错）。isError 为真时可做不同处理，这里统一显示文字即可。
function showMessage(text) {
  messageBox.textContent = text; // 把文字放进提示区
}

// 渲染"选中那天"的大卡片。参数 index 是第几天（0=今天，1=明天……）
function renderCurrentCard(index) {
  const d = currentDaily;                   // 取出7天数据（简写方便用）
  const code = d.weather_code[index];       // 这天的天气代码
  const w = decodeWeather(code);            // 翻译成 {type,label,icon}

  // 用模板字符串(反引号``)拼出一大段HTML。${...}里可以直接塞变量值。
  currentCard.innerHTML = `
    <div class="city-name">${currentCity}</div>
    <div class="date">${formatDate(d.time[index])}</div>
    <div class="current">
      <div class="icon">${w.icon}</div>
      <div>
        <div class="temp">${Math.round(d.temperature_2m_max[index])}°</div>
        <div class="desc">${w.label} · 最低 ${Math.round(d.temperature_2m_min[index])}°</div>
      </div>
    </div>
    <div class="details">
      <div class="item">降水概率<b>${d.precipitation_probability_max[index]}%</b></div>
      <div class="item">最大风速<b>${Math.round(d.wind_speed_10m_max[index])} km/h</b></div>
      <div class="item">日出<b>${d.sunrise[index].slice(11)}</b></div>
      <div class="item">日落<b>${d.sunset[index].slice(11)}</b></div>
      <div class="item">紫外线<b>${Math.round(d.uv_index_max[index])}</b></div>
      <div class="item">温差<b>${Math.round(d.temperature_2m_max[index] - d.temperature_2m_min[index])}°</b></div>
    </div>
  `;
  currentCard.style.display = "block"; // 让大卡片显示出来（之前是隐藏的）
  setAnimation(w.type);                // 根据这天的天气类型，切换背景动画
}

// 渲染"未来7天"的小卡片列表
function renderForecastList() {
  const d = currentDaily;        // 取出7天数据
  forecastList.innerHTML = "";   // 先清空容器（防止重复搜索时旧卡片堆积）

  // 循环7次（i 从0到6），每次造一张小卡片
  for (let i = 0; i < d.time.length; i++) {
    const w = decodeWeather(d.weather_code[i]); // 翻译这天的天气

    // 创建一个空的 div 元素（相当于拿一张空白卡片）
    const dayEl = document.createElement("div");
    dayEl.className = "day";                     // 给它加上 .day 样式类
    if (i === 0) dayEl.classList.add("active");  // 第0天(今天)默认选中，加高亮

    // 填入卡片内容：左边图标+星期，右边高低温
    dayEl.innerHTML = `
      <div class="day-left">
        <span class="day-icon">${w.icon}</span>
        <span>${i === 0 ? "今天" : formatDate(d.time[i])}</span>
      </div>
      <div class="day-temp">${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°</div>
    `;

    // 给这张小卡片绑定"被点击时做什么"：切换到这一天
    // 这里把 i 存进去，点击时就知道点的是第几天
    dayEl.addEventListener("click", () => selectDay(i));

    // 把造好的卡片塞进列表容器
    forecastList.appendChild(dayEl);
  }
  forecastTitle.style.display = "block"; // 显示"未来7天"标题
}

// 点击某一天时调用：更新高亮 + 刷新大卡片 + 切动画
function selectDay(index) {
  // 把所有小卡片的"选中高亮"去掉
  document.querySelectorAll(".day").forEach(el => el.classList.remove("active"));
  // 只给被点的那张加回高亮（它是列表里第 index 个）
  forecastList.children[index].classList.add("active");
  // 刷新上方大卡片为这一天（renderCurrentCard 内部会顺带切动画）
  renderCurrentCard(index);
}

// ============================================================
// 切换背景动画：根据天气类型(type)，给 body 换类名、往动画层撒粒子
// ============================================================
function setAnimation(type) {
  // 先清掉 body 上所有旧的天气类名，再加上新的，这样背景色会跟着变
  document.body.className = "weather-" + type;
  // 清空动画层里的旧粒子（旧的雨丝/雪花等）
  animLayer.innerHTML = "";

  if (type === "clear") {
    // 晴天：放一个太阳
    animLayer.innerHTML = '<div class="sun"></div>';
  } else if (type === "cloudy" || type === "fog") {
    // 多云/雾：放几朵飘动的云（位置和延迟错开，更自然）
    for (let i = 0; i < 4; i++) {
      const cloud = document.createElement("div");
      cloud.className = "cloud";
      cloud.style.top = (10 + i * 18) + "%";        // 每朵云高度错开
      cloud.style.animationDelay = (-i * 6) + "s";  // 启动时间错开，避免整齐划一
      animLayer.appendChild(cloud);
    }
  } else if (type === "rain") {
    // 雨：撒很多根雨丝
    for (let i = 0; i < 60; i++) {
      const drop = document.createElement("div");
      drop.className = "raindrop";
      drop.style.left = Math.random() * 100 + "%";              // 横向随机位置
      drop.style.animationDuration = (0.5 + Math.random() * 0.5) + "s"; // 下落速度随机
      drop.style.animationDelay = Math.random() * 2 + "s";     // 起始时间随机
      animLayer.appendChild(drop);
    }
  } else if (type === "snow") {
    // 雪：撒很多片雪花
    for (let i = 0; i < 50; i++) {
      const flake = document.createElement("div");
      flake.className = "snowflake";
      flake.style.left = Math.random() * 100 + "%";            // 横向随机
      flake.style.animationDuration = (3 + Math.random() * 3) + "s"; // 飘落速度随机(比雨慢)
      flake.style.animationDelay = Math.random() * 3 + "s";    // 起始随机
      animLayer.appendChild(flake);
    }
  } else if (type === "thunder") {
    // 雷暴：又下雨又闪电
    const lightning = document.createElement("div");
    lightning.className = "lightning";
    animLayer.appendChild(lightning);                           // 先放闪电层
    for (let i = 0; i < 60; i++) {                              // 再撒雨丝
      const drop = document.createElement("div");
      drop.className = "raindrop";
      drop.style.left = Math.random() * 100 + "%";
      drop.style.animationDuration = (0.4 + Math.random() * 0.4) + "s";
      drop.style.animationDelay = Math.random() * 2 + "s";
      animLayer.appendChild(drop);
    }
  }
}

// ============================================================
// 第5段：搜索、定位、启动
// ============================================================

// 总流程：根据城市名查天气并显示。async 因为里面要等网络。
async function searchByCity(cityName) {
  try {
    // try 块：把"可能出错"的事放这里；一旦出错，自动跳到下面的 catch，不会整个崩掉
    showMessage("加载中…");                 // 先提示用户正在加载
    const coords = await fetchCoords(cityName); // 第1步：城市名→坐标（要等）
    const daily  = await fetchWeather(coords.lat, coords.lon); // 第2步：坐标→7天天气（要等）

    currentDaily = daily;         // 记住数据
    currentCity  = coords.name;   // 记住城市名
    showMessage("");              // 清空"加载中"提示

    renderForecastList();         // 画7天列表
    renderCurrentCard(0);         // 默认显示第0天(今天)的大卡片+动画
  } catch (err) {
    // 出错时（比如城市找不到、断网）走这里，友好地提示，而不是让程序崩溃
    showMessage("出错了：" + err.message);
  }
}

// 定位：用浏览器自带的定位能力拿到坐标，再查天气
function locate() {
  // navigator.geolocation 是浏览器的定位功能；先判断浏览器支不支持
  if (!navigator.geolocation) {
    showMessage("你的浏览器不支持定位");
    return; // 不支持就直接结束
  }
  showMessage("正在定位…");
  // getCurrentPosition(成功时做什么, 失败时做什么)
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      // 成功：pos.coords 里有纬度经度。直接用坐标查天气。
      try {
        const daily = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
        currentDaily = daily;
        currentCity  = "我的位置";  // 定位来的，名字就叫"我的位置"
        showMessage("");
        renderForecastList();
        renderCurrentCard(0);
      } catch (err) {
        showMessage("定位成功但取天气失败：" + err.message);
      }
    },
    () => {
      // 失败：常见原因是用户拒绝、或用 file:// 打开被浏览器限制。给友好提示并退回北京。
      showMessage("定位失败（可能被浏览器拦截），已显示北京天气");
      searchByCity("北京");
    }
  );
}

// ---- 绑定按钮和输入框的操作 ----
// 点"搜索"按钮：取输入框文字去搜。.trim() 去掉首尾空格；有内容才搜。
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (city) searchByCity(city);
});
// 在输入框里按回车键，也触发搜索（更顺手）
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const city = cityInput.value.trim();
    if (city) searchByCity(city);
  }
});
// 点"📍"定位按钮
locateBtn.addEventListener("click", locate);

// ---- 启动：网页一打开，默认先显示北京天气，保证不白屏 ----
searchByCity("北京");

