const startButton = document.querySelector("#start");
const accountList = document.querySelector("#accounts");
const logArea = document.querySelector("#log");
const output = document.querySelector("#output");
const statusElement = document.querySelector("#status");

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
    request = new Request('https://corsproxy.io/?url=https://smurf.new-chapter.eu/api/check_player?player_id=' + id, { cache: "no-cache" })

    try {
        const response = await fetch(request);
        if (response.status !== 200) {
            throw new Error("Something went wrong on the NC server!");
        }
        const data = await response.json()

        if (data.truncated) log(`Smurf response for ${name} (${id}) was truncated. Please report to SyntacticSalt.`);

        if (data.smurfs.length > 1) log(`Smurf response for ${name} (${id}) contained unexpected entries. Please report to SyntacticSalt.`);

        return data.smurfs[0]
    } catch (error) {
        log('Failed to retrieve reference data:')
        log(error);
    }
}

async function fetchActivityData(name, ids) {
    request = new Request(`https://corsproxy.io/?url=https://aoe-api.worldsedgelink.com/community/leaderboard/GetPersonalStat?title=age2&profile_ids=[${ids.join(',')}]`, { cache: "no-cache" })

    try {
        const response = await fetch(request);
        if (response.status !== 200) {
            throw new Error("Something went wrong on the WE server!");
        }
        const data = await response.json()

        if (data.result.code != 0) throw new Error(data.result.message);

        const activeIds = new Set()
        const activeStatGroups = new Set()
        data.leaderboardStats.filter(s => s.leaderboard_id == 3).forEach(s => {
            if (Date.now() - (s.lastmatchdate * 1000) <= (14 * 86400 * 1000)) {
                activeStatGroups.add(s.statgroup_id)
            }
        })

        data.statGroups.forEach(s => {
            if (activeStatGroups.has(s.id)) {
                activeIds.add(s.members[0].profile_id.toString())
            }
        })

        return activeIds
    } catch (error) {
        log('Failed to retrieve reference data:')
        log(error);
    }
}

const delay = ms => new Promise(res => setTimeout(res, ms * 1000));

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
            await delay(6)

            if (!smurfData) continue;

            smurfData.forEach(smurf => {
                checkedIds.add(smurf.profile_id)
                data.ids.add(smurf.profile_id)
            })
        }

        log('Checking for account activity...')
        const activeIds = await fetchActivityData(data.name, Array.from(data.ids))

        const li = document.createElement('li')
        li.innerText = `${data.name}: `
        Array.from(data.ids).forEach(id => {
            const s = document.createElement('span')
            s.innerText = id
            if (activeIds.has(id)) s.classList.add('text-success')
            li.appendChild(s)
            li.append(", ")
        })
        li.classList.add('list-group-item')

        if (activeIds.size > 1) {
            li.classList.add('text-bg-danger')
        }

        output.appendChild(li)

        await delay(5)
        log('')
    }

    statusElement.classList.add('hidden')
    log('Done.')
}

startButton.addEventListener("click", run);
