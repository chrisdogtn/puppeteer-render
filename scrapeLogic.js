const puppeteer = require("puppeteer");
require("dotenv").config();

const scrapeLogic = async (res) => {
  const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
  try {
    const page = await browser.newPage();

    // Step 1: Go to the login page and extract the CSRF token
    await page.goto("https://rentmanapp.com/login", {
      waitUntil: "networkidle2",
    });
    const csrfToken = await page.evaluate(() => {
      const tokenInput = document.querySelector('input[name="_token"]');
      return tokenInput ? tokenInput.value : null;
    });

    if (!csrfToken) {
      console.error("Failed to retrieve CSRF token");
      await browser.close();
      return;
    }

    console.log(`CSRF Token: ${csrfToken}`);

    // Step 2: Perform the login action
    await page.type('input[name="email"]', "Chris@chattanoogaproaudio.com");
    await page.type('input[name="password"]', "H12awkss!");
    await page.evaluate((token) => {
      document.querySelector('input[name="_token"]').value = token;
    }, csrfToken);

    await page.click('button[type="submit"]'); // Assuming the login button is of type submit
    console.log("waiting");
    await page.waitForSelector(".account-loginbutton");
    console.log("waiting2");
    // Step 3: Retrieve cookies after login
    const cookies = await page.cookies();
    const rentmanSessionCookie = cookies.find(
      (cookie) => cookie.name === "rentman_session"
    );

    if (!rentmanSessionCookie) {
      console.error("Failed to retrieve rentman_session cookie after login");
      await browser.close();
      return;
    }

    console.log("Rentman Session Cookie:", rentmanSessionCookie.value);

    // Step 4: Use the cookie to get the JWT
    await page.setCookie({
      name: "rentman_session",
      value: rentmanSessionCookie.value,
      domain: ".rentmanapp.com",
    });

    const jwtResponse = await page.goto(
      "https://rentmanapp.com/account/getJWTLoginUrl/chattanoogaproaudio",
      {
        waitUntil: "networkidle2",
      }
    );

    const jsonResponse = await jwtResponse.json();
    console.log("JWT Response:", jsonResponse);
    const urlParams = new URLSearchParams(jsonResponse.url);
    const jwtToken = urlParams.get(
      "https://chattanoogaproaudio.rentmanapp.com/#/login?jwt"
    );
    console.log("Extracted JWT Token:", jwtToken);

    await browser.close();
    res.send(jwtToken);
    return jwtToken;
  } catch (e) {
    console.error(e);
    res.send(`Something went wrong while running Puppeteer: ${e}`);
  } finally {
    await browser.close();
  }
};

module.exports = { scrapeLogic };
