
async function postData(url = "", name = "", phone = "") {
  // Default options are marked with *
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: "follow", // manual, *follow, error
    referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify({
      fullname: `${name}`,
      email: "info@cancifci.com",
      phone: `${phone}`,
      utm_source: "Github",
      utm_medium: "Refer Medium",
      utm_campaign: "Kampanya",
      refer: "Google Inc",
    }), // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

async function makeStress(name, phone) {
  const result = await postData(
    "http://localhost:3000/lead/create",
    name,
    phone
  );
  return result;
}

async function generateFakeName() {
  const response = await fetch(
    "https://api.namefake.com/",
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  const data = await response.json();
  const name = `${data.name}`;
  return name;
}
let count = 0;
let limit = 501;
const startTime = process.hrtime();
const intervalId = setInterval(async () => {
  let phone = Math.floor(Math.random() * 1000000000000);
  count++;
  if (count === limit) {
    clearInterval(intervalId);
    console.log(`${limit} limite ulaşıldı işlem kesildi!`);
    const endTime = process.hrtime(startTime);
    const totalTimeInSeconds = endTime[0] + endTime[1] / 1e9;
    console.log(`İşlem ${totalTimeInSeconds} saniye sürdü.`);
  }
  try {
    //const name = await generateFakeName();
    const result = await makeStress(`mahmut yeni`, phone);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}, 100);
