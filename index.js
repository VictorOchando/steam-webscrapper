const puppeteer = require("puppeteer");
var nodemailer = require("nodemailer");

var transport = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
    },
});

transport.verify(function (error) {
    if (error) {
        console.log(error);
    } else {
        console.log("Server is ready to take our messages");
    }
});

const originalUrl =
    "https://store.steampowered.com/specials#p=0&tab=NewReleases";
var totalUrls = [];

puppeteer.launch().then(async (browser) => {
    let page = await browser.newPage();
    await page.goto(originalUrl);
    await page.waitForTimeout(1000);
    let totalElements = await page.evaluate(() => {
        return document.querySelector("span#NewReleases_total").innerText;
    });
    const totalPages = Math.round(totalElements / 15);
    console.log(totalElements);

    for (let i = 0; i <= totalPages; i++) {
        //Create array with al urls to scrap
        totalUrls.push(
            "https://store.steampowered.com/specials#p=" +
                i +
                "&tab=NewReleases"
        );
    }
    console.log(totalUrls);

    var totalGames = [];
    for (let url of totalUrls) {
        console.log("scraping:" + url);
        page = await browser.newPage();
        //page.on("console", (log) => console[log._type](log._text)); //Only necessary if you need console messages during evaluate
        await page.goto(url);
        await page.waitForTimeout(1000);
        let gamesFromPage = await page.evaluate(() => {
            const divsName = document.body.querySelectorAll(
                "div#tab_content_NewReleases div.tab_item_name"
            );

            const divsDiscountPct = document.body.querySelectorAll(
                "div#tab_content_NewReleases div.discount_pct"
            );
            const divsNewPrice = document.body.querySelectorAll(
                "div#tab_content_NewReleases div.discount_final_price"
            );
            const divsLink = document.body.querySelectorAll(
                "div#tab_content_NewReleases a"
            );
            const divsImg = document.body.querySelectorAll(
                "div#tab_content_NewReleases img.tab_item_cap_img"
            );

            let names = [];
            for (let name of divsName) {
                names.push(name.innerText);
            }
            let discountsPct = [];
            for (let discountPct of divsDiscountPct) {
                discountsPct.push(discountPct.innerText);
            }

            let newPrices = [];
            for (let newPrice of divsNewPrice) {
                newPrices.push(newPrice.innerText);
            }

            let links = [];
            for (let link of divsLink) {
                links.push(link.href);
            }

            let imgs = [];
            for (let img of divsImg) {
                imgs.push(img.src);
            }

            let games = [];

            for (let i = 0; i < names.length; i++) {
                games.push({
                    name: names[i],
                    discountPct: discountsPct[i],
                    newPrice: newPrices[i],
                    link: links[i],
                    img: imgs[i],
                });
            }
            return games;
        });
        totalGames.push(gamesFromPage);
    }

    totalGames = totalGames.flat();
    totalGames.sort(
        (a, b) => parseFloat(a.discountPct) - parseFloat(b.discountPct)
    );

    var content = totalGames.reduce(function (a, b) {
        return (
            a +
            "<tr><td><img style='color:#C7D5E0' src=" +
            b.img +
            "></td>" +
            "<td style='width:50%;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse;'><a style='color:#C7D5E0;' href=" +
            b.link +
            ">" +
            b.name +
            "</a></td><td style='color:#C7D5E0;width:20%;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse; text-align:center;'>" +
            b.discountPct +
            "</td><td style='color:#C7D5E0;width:20%;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse;text-align:center'>" +
            b.newPrice +
            "</td></tr>"
        );
    }, "");

    transport.sendMail(
        {
            from: '"New releases Steam Recaps" <newreleases@steamrecaps.com>',
            to: "user1@example.com, user2@example.com",
            subject: "Your latest Steam offers new releases recap!",
            text: JSON.stringify(totalGames, null, 4),
            html:
                "<div><table style= 'background:#1b2838;border-collapse: collapse;border: 1px solid #eee;border-bottom: 2px solid  #0F1418 ;box-shadow: 0px 0px 20px rgba(0,0,0,0.10),0px 10px 20px rgba(0,0,0,0.05),0px 20px 20px rgba(0,0,0,0.05),0px 30px 20px rgba(0,0,0,0.05);'><thead><tr><th style='background:#0F1418 ;color: #fff;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse'>IMG</th><th style='width:50%;background: #0F1418 ;color: #fff;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse; text-align: left'>TITLE</th><th style='width:20%;background:#0F1418;color: #fff;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse'>DISCOUNT %</th><th style='width:20%;background:#0F1418;color: #fff;border: 1px solid #eee;padding: 12px 35px;border-collapse: collapse'>PRICE</th></tr></thead><tbody>" +
                content +
                "</tbody></table></div>",
        },
        (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log("Message sent: %s", info.messageId);
        }
    );
    await browser.close();
});
