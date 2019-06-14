import pptr from 'puppeteer'
import fs from 'fs-extra'
import { resolve } from 'path'

interface pass {
  login: string
  password: string
}

interface subject {
  gathered: number
  max: number
}

interface subjectsMap {
  [name: string]: subject
}

async function main() {
  const link = 'https://2lo-gorzow.sad.edu.pl//'
  const { login, password } = await loadPass()

  const browser = await pptr.launch({
    headless: false,
  })

  const p = await browser.newPage()
  await p.goto(link, {
    waitUntil: 'networkidle0',
  })

  const click = initClick(p)

  await p.evaluate(
    (login: string, password: string) => {
      const lb = document.querySelector(`[type="text"]`) as HTMLInputElement
      const pb = document.querySelector(`[type="password"]`) as HTMLInputElement

      lb.value = login
      pb.value = password
    },
    login,
    password
  )

  await click("button[role='button']")

  // Btns' and anchrs' ids
  const uczenID = `button[style="width:90%; height:auto; padding: 0px;"]`
  const ocenyID = 'a[href="#ui-tabs-3"]'

  await click(uczenID)
  await click(ocenyID)
  
  let outMap = {} as subjectsMap

  await p.waitForSelector("[id*='_label']")
  /**
   * '#'+/c\d{1,3}/.exec(x.id)[0]
   */
  // @ts-ignore
  const trims = await p.evaluate((): string[] => [...document.querySelectorAll("[id*='_label']")].map(x => "input#"+/c\d{1,3}/.exec(x.id)[0]))

  console.log(trims)
  await p.waitFor(2000)
  for (const t of trims) {
    console.log(await p.evaluate(t => {
      const el = document.querySelector(t)
      if(el) el.style.border = "5px solid red"
      el&&el.click&&el.click()
      return !!el
    }, t))
    await p.waitForSelector(`[class='ui-widget-header']`)
    console.log(t)
    await p.waitForSelector(".ui-state-active.ui-corner-left.tooltipTarget")

    reduceSubjectsMaps(outMap, await p.evaluate((): subjectsMap => {
      // @ts-ignore
      return [...document.querySelector(`[id*=contRates]`).querySelectorAll("table > tbody > tr")].filter(r => r.querySelector(".ui-state-active.ui-corner-left.tooltipTarget"))
      .reduce((acc, r) => {
        const name_regex = /(([\węąśćłź\s])+){1,2}/gui
        const unparsed_name = (r.querySelector(".ui-state-active.ui-corner-left.tooltipTarget") as HTMLTableDataCellElement).innerText
        const name = (name_regex.exec(unparsed_name) as string[])[0].replace(/\s\d+.+/g, "").trim()

        const gradeBox = (r.querySelector(`[style="white-space:nowrap; height:19px; text-align:left; padding-left:5px; padding-right:5px; text-align:right;"]`)as HTMLTableDataCellElement).innerText
        const [g, m] = (/\d+\/\d+/.exec(gradeBox) as string[]) [0].split("/").map(Number)

        if(!acc[name]) acc[name] = {
          gathered: 0,
          max: 0
        }

        acc[name].gathered += g
        acc[name].max += m

        return acc
      }, {} as subjectsMap)
    }))
  }

  console.log(outMap)

  const vs = Object.values(outMap)
  console.log(vs.reduce((acc, x) =>
    acc += x.gathered / x.max
  , 0)/vs.length *6)
}

function reduceSubjectsMaps(accMap: subjectsMap, map: subjectsMap) {
  console.log(map)
  for(const key in map) {
    if(!accMap[key]) accMap[key] = map[key]
    else {
      accMap[key].gathered += map[key].gathered
      accMap[key].max += map[key].max
    }
  }

  return accMap
}
function initClick(page: pptr.Page) {
  return async function click(selector: string) {
    await page.waitForSelector(selector)
    return page.click(selector)
  }
}

function loadPass(): Promise<pass> {
  return fs.readFile(resolve(__dirname, 'pass.json'), 'utf-8').then(JSON.parse)
}
main()
