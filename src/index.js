import { parse } from "node-html-parser";
import axios from "axios";
import fs from "fs";
import shell from "shelljs";

// Gathers needed git commands for bash to execute per provided contribution data.
const getCommand = (contribution) => {
  return `GIT_AUTHOR_DATE=${contribution.date}T12:00:00 GIT_COMMITER_DATE=${contribution.date}T12:00:00 git commit --allow-empty -m "Rewriting History!" > /dev/null\n`.repeat(
    contribution.count
  );
};

export default async (input) => {
  // Returns contribution graph html for a full selected year.
  const res = await axios.get(
    `https://github.com/${input.username}?tab=overview&from=${input.year}-12-01&to=${input.year}-12-31`
  );

  // Retrieves needed data from the html, loops over green squares with 1+ contributions,
  // and produces a multi-line string that can be run as a bash command.
  const document = parse(res.data);

  // The actual data is now stored in tooltips that are attached to the contribution squares through the virtual dom.
  // Therefore we have to query for the tooltips and then get the data from the corresponding contribution square.
  const elements = document.querySelectorAll("tool-tip[for^=contribution-day-component]");

  const days = elements.map((el) => {
    const innerContent = el?.innerText;
    if (!innerContent) return;
    const numContributions = innerContent.split(innerContent.includes('contributions') ? ' contributions' : ' contribution')?.[0];

    // Find the matching contribution square and get the date from it.
    const pairElement = document.getElementById(el?.getAttribute("for"));
    const date = pairElement?.getAttribute("data-date");

    return {
      date,
      count: isNaN(parseInt(numContributions)) ? 0 : parseInt(numContributions),
    };
  });
  
  const filteredDays = days.filter((contribution) => contribution.count > 0);

  const script = filteredDays.map((contribution) => getCommand(contribution))
    .join("\n")
    .concat("git pull origin main\n", "git push -f origin main");

  fs.writeFile("script.sh", script, () => {
    console.log("\nFile was created successfully.");

    if (input.execute) {
      console.log("This might take a moment!\n");
      shell.exec("sh ./script.sh");
    }
  });
};
