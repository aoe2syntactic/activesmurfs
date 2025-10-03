const startButton = document.querySelector("#start");
const accountList = document.querySelector("#accounts");
const logArea = document.querySelector("#log");
const output = document.querySelector("#output");
const statusElement = document.querySelector("#status");
const weekSelector = document.querySelector("#weekSelector");

function log(message) {
    logArea.textContent += message + '\n'
}

function reset() {
    logArea.textContent = ''
    output.innerHTML = ''
    statusElement.classList.remove('hidden')
}

async function loadReferenceData() {
    request = new Request('https://raw.githubusercontent.com/SiegeEngineers/aoc-reference-data/refs/heads/master/data/players.yaml')

    try {
        const response = await fetch(request);
        if (response.status !== 200) {
            throw new Error("Something went wrong on the reference data server!");
        }
        const data = jsyaml.load(await response.text())
        log('Loaded reference data.')
        return data
    } catch (error) {
        log('Failed to retrieve reference data:')
        log(error);
    }
}

async function fetchSmurfData(name, id) {
    const url = `https://aoe.mbergen.de/api/snc/${id}`
    request = new Request(url)

    try {
        const response = await fetch(request);
        if (response.status !== 200) {
            throw new Error("Something went wrong on the NC server!");
        }
        const data = await response.json()

        if (data.truncated) log(`Smurf response for ${name} (${id}) was truncated. Please report to SyntacticSalt.`);

        if (!data.smurfs) {
            log(`Did not receive a smurf response.`);
            return;
        }

        if (data.smurfs.length > 1) log(`Smurf response for ${name} (${id}) contained unexpected entries. Please report to SyntacticSalt.`);

        return data.smurfs[0]
    } catch (error) {
        log('Failed to retrieve reference data:')
        log(error);
    }
}

async function fetchActivityData(input) {
    const ids = Array.from(input.ids)
    const url = `https://aoe.mbergen.de/api/wel/getPersonalStat?profiles=${ids.join('&profiles=')}`
    request = new Request(url)

    try {
        const response = await fetch(request);
        if (response.status !== 200) {
            throw new Error("Something went wrong on the WE server!");
        }
        const data = await response.json()

        if (data.result.code != 0) throw new Error(data.result.message);
        input.name = input.name ?? data.statGroups[0].members[0].alias

        const latestDatePerGroup = new Map()
        data.leaderboardStats.forEach(s => {
            latestDatePerGroup.set(s.statgroup_id, Math.max(latestDatePerGroup.get(s.statgroup_id) ?? 0, s.lastmatchdate * 1000))
        })
        const activity = new Map(data.statGroups.map(s => [s.members[0].profile_id.toString(), latestDatePerGroup.get(s.id)]))
        return activity
    } catch (error) {
        log('Failed to retrieve reference data:')
        log(error);
    }
}


function createHighlights() {
    weeks = weekSelector.value

    output.querySelectorAll('li span').forEach(el => {
        if (Date.now() - el.dataset['lastmatch'] < weeks * 7 * 86400 * 1000) {
            el.classList.add('text-success')
        } else {
            el.classList.remove('text-success')
        }
    })

    output.querySelectorAll('li').forEach(el => {
        if (el.querySelectorAll('span.text-success').length > 1) {
            el.classList.add('text-bg-danger')
        } else {
            el.classList.remove('text-bg-danger')
        }
    })
}

async function run() {
    reset()
    log('Starting activity check.')

    const accountsToCheck = accountList.value.split('\n').map(el => el.trim()).filter(el => el.length > 0)

    if (accountsToCheck.length == 0) {
        log('No accounts entered.')
        log('Done.')
        statusElement.classList.add('hidden')
        return
    }
    log(`${accountsToCheck.length} accounts entered.`)

    /**
     * @type RefData[]
     */
    const referenceData = await loadReferenceData()
    log('')

    function enrichFromReferenceData(data) {
        let entry = referenceData.find(el => {
            if (data.name && el.name.toLowerCase() == data.name.toLowerCase()) {
                return true
            }
            if (el.platforms && el.platforms.rl) {
                return el.platforms.rl.filter(id => data.ids.has(id)).length > 0
            }
        })

        if (entry) {
            log(`Found reference data for '${entry.name}'`)
            data.name = entry.name
            entry.platforms.rl.forEach(el => {
                if (el.includes('hc')) return;
                data.ids.add(el)
            })
        }
    }

    for (account of accountsToCheck) {
        log(`Checking for input '${account}'...`)

        const data = {
            ids: new Set()
        }

        if (/^\d+$/.test(account)) {
            data.ids.add(account)
        } else {
            data.name = account
        }

        enrichFromReferenceData(data)

        const checkedIds = new Set()
        log('Checking Smurf database for IDs...')
        for (const id of Array.from(data.ids)) {
            if (checkedIds.has(id)) continue;
            checkedIds.add(id)

            const smurfData = await fetchSmurfData(data.name, id)

            if (!smurfData) continue;

            smurfData.forEach(smurf => {
                checkedIds.add(smurf.profile_id)
                data.ids.add(smurf.profile_id)
            })
        }

        log('Checking for account activity...')
        const lastMatchData = await fetchActivityData(data)

        const li = document.createElement('li')
        li.innerText = `${data.name}: `
        Array.from(data.ids).forEach(id => {
            const s = document.createElement('span')
            s.innerText = id
            s.dataset['lastmatch'] = lastMatchData.get(id)
            s.title = (new Date(lastMatchData.get(id)))
            li.appendChild(s)
            li.append(", ")
        })
        li.classList.add('list-group-item')

        output.appendChild(li)
        log('')
    }

    statusElement.classList.add('hidden')
    createHighlights()
    log('Done.')
}

startButton.addEventListener("click", run);
weekSelector.addEventListener("input", createHighlights)
