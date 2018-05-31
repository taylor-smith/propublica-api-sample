const csv = require('csv-parser');
const fs = require('fs');
const http = require('http');
const https = require('https');

const districts = [];

let assembleDistricts = new Promise((resolve, reject) => {
    fs
        .createReadStream('membership_members.csv')
        .pipe(csv())
        .on('data', function(data) {
            districts.push({
                state: data.State,
                district: data.District
            });
        })
        .on('finish', () => resolve());
});

assembleDistricts.then(() => {
    fetchCongress.then(res => {
        const members = res.results[0].members;
        filterMembers(members);
    });
});

fetchCongress = new Promise((resolve, reject) => {
    const options = {
        host: 'api.propublica.org',
        path: '/congress/v1/115/house/members.json',
        method: 'GET',
        headers: {
            'x-api-key': 'PROPUBLICA_API_KEY_HERE'
        }
    };
    let result = '';
    const req = https.request(options, res => {
        res.on('data', chunk => {
            result = result + chunk;
        });
        res.on('end', () => {
            const json = JSON.parse(result);
            resolve(json);
        });
    });
    req.on('error', e => {
        reject(e);
    });
    req.end();
});

filterMembers = members => {
    const filteredMembers = districts.map(district => {
        return members.find(member => {
            return (
                member.district === district.district &&
                member.state === district.state
            );
        });
    });
    getMemberDetails(filteredMembers);
};

getMemberDetails = filteredMembers => {
    const request = member => {
        return new Promise((resolve, reject) => {
            const options = {
                host: 'api.propublica.org',
                path: '/congress/v1/members/' + member.id + '.json',
                method: 'GET',
                headers: {
                    'x-api-key': 'PROPUBLICA_API_KEY_HERE'
                }
            };
            let result = '';
            const req = https.request(options, res => {
                res.on('data', chunk => {
                    result = result + chunk;
                });
                res.on('end', () => {
                    const json = JSON.parse(result);
                    resolve(json);
                });
            });
            req.on('error', e => {
                reject(e);
            });
            req.end();
        });
    };

    const actions = filteredMembers.map(request);
    const memberDetails = [];
    const results = Promise.all(actions).then(data => {
        const details = data.map(obj => obj.results[0]);
        cleanObjs(details);
    });
};

cleanObjs = details => {
    const relevantDetails = details.map(detail => {
        return {
            name: detail.first_name + ' ' + detail.last_name,
            committees: detail.roles[0].committees
        };
    });
    crossReferenceCommittees(relevantDetails);
};

const CommitteeEnums = [
    'Committee on Transportation and Infrastructure',
    'Committee on Appropriations',
    'Committee on Agriculture',
    'Committee on Natural Resources',
    'Committee on Energy and Commerce'
];

crossReferenceCommittees = relevantDetails => {
    const obj = {
        'Committee on Transportation and Infrastructure': [],
        'Committee on Appropriations': [],
        'Committee on Natural Resources': [],
        'Committee on Energy and Commerce': [],
        'Committee on Agriculture': []
    };
    relevantDetails.forEach(detail => {
        const isOnCommittees = detail.committees.forEach(committee => {
            if (
                committee.name ===
                'Committee on Transportation and Infrastructure'
            ) {
                obj['Committee on Transportation and Infrastructure'].push(
                    detail
                );
            }
            if (committee.name === 'Committee on Appropriations') {
                obj['Committee on Appropriations'].push(detail);
            }
            if (committee.name === 'Committee on Natural Resources') {
                obj['Committee on Natural Resources'].push(detail);
            }
            if (committee.name === 'Committee on Energy and Commerce') {
                obj['Committee on Energy and Commerce'].push(detail);
            }
            if (committee.name === 'Committee on Agriculture') {
                obj['Committee on Agriculture'].push(detail);
            }
        });
    });
};
