const routes = require('express').Router();
const db = require('./connect');
const fs = require('fs');
require('es6-promise').polyfill();
require('isomorphic-fetch');

routes.get('/buscar-emails', (req, res) => {
    // let seller_id = '236088666';
    // let access_token = 'APP_USR-8021611602487823-082821-644451b2ffbbdcbaafc041ac4baab966-236088666';
    console.time('demorando');
    db.query('SELECT contas.ID FROM contas WHERE contas.ATIVA = 1', (err, selectIdRes, field) => {
        if (err) {
            console.log('SELECT ERROR: ', err);
        }

        for (let dbIds in selectIdRes) {
            db.query(`SELECT contas.ACCESSTOKEN FROM contas WHERE contas.ID = ${selectIdRes[dbIds].ID}`, async (err, dbAccessResult, field) => {
                const { ID: seller_id } = selectIdRes[dbIds];
                const { ACCESSTOKEN: access_token } = dbAccessResult[0];
                if (err) {
                    console.log('SELECT ERROR: ', err);
                }
                let emails = [];

                if (access_token === 'DESATIVADO') return;

                const ordersPackId = []
                let total = 50;
                let offset = 0;
                const limit = 50;

                for (let i = 0; i < total; i += 50) {
                    const ordersRes = await fetch(`https://api.mercadolibre.com/orders/search?seller=${seller_id}&access_token=${access_token}&offset=${i}&limit=${limit}&order.date_created.from=2019-07-01T00:00:00.000-00:00&order.date_created.to=2019-08-27T00:00:00.000-00:00`);

                    const resultado = await ordersRes.json();
                    const { results, paging } = resultado
                    if (results) {
                        //console.log(resultado);
                        total = paging.total;
                        for (let resu in results) {
                            //console.log(results[resu]);
                            const { pack_id } = results[resu];

                            if (pack_id) {
                                ordersPackId.push({ pack_id, buyer: { ...results[resu].buyer } });
                            }
                        }
                    }
                }
                if (ordersPackId.length <= 0) return;

                console.log('VENDEDOR: ', seller_id)
                console.log('TOTAL: ', total)
                //console.time('TempoBuscas')
                emails.push(...(await buscarPorOrderPackId(ordersPackId, seller_id, access_token)));

                //console.log(emails);
                for (let email in emails) {
                    const selectEmailsQuery = `SELECT desmascaradostmp.IDCOMPRADOR FROM desmascaradostmp WHERE desmascaradostmp.IDCOMPRADOR = ${emails[email].user_id} AND desmascaradostmp.idConta = ${seller_id}`
                    db.query(selectEmailsQuery, async (err, selectEmailsResult, field) => {
                        if (err) {
                            console.log('INSERT ERROR: ', err);
                        }

                        //console.log(selectEmailsResult);
                        if (selectEmailsResult.length > 0) {
                            return;
                        }

                        const apelido = emails[email].nickname ? `'${emails[email].nickname}'` : null,
                            complementoTelefone = emails[email].phone.extension ? `'${emails[email].phone.extension}'` : null,
                            codigoArea = emails[email].phone.area_code ? `'${emails[email].phone.area_code}'` : null,
                            emailEmail = emails[email].email ? `'${emails[email].email}'` : null,
                            idComprador = emails[email].id ? `'${emails[email].id}'` : null,
                            name = emails[email].first_name ? `'${(emails[email].first_name).replace("'", "''")}'` : null,
                            docNumber = emails[email].billing_info.doc_number ? `'${emails[email].billing_info.doc_number}'` : null,
                            lastName = emails[email].last_name ? `'${(emails[email].last_name).replace("'", "''")}'` : null,
                            numeroTelefone = emails[email].phone.number ? `'${emails[email].phone.number}'` : null,
                            docType = emails[email].billing_info.doc_type ? `'${emails[email].billing_info.doc_type}'` : null,
                            idConta = seller_id ? `'${seller_id}'` : null;


                        if (selectEmailsResult.length <= 0) {
                            const insertQuery = `INSERT INTO desmascaradostmp (APELIDO, COMPLEMENTOTELEFONE, DDD, EMAIL, IDCOMPRADOR, NOME, NUMERODOCUMENTO, SOBRENOME, TELEFONE, TIPODOCUMENTO, idConta) VALUES (${apelido}, ${complementoTelefone}, ${codigoArea}, ${emailEmail}, ${idComprador}, ${name}, ${docNumber}, ${lastName}, ${numeroTelefone}, ${docType}, ${idConta});`
                            db.query(insertQuery, async (err, insertResult, field) => {
                                if (err) {
                                    console.log('INSERT ERROR: ', err);
                                }

                                //console.log('inseriu');
                            });
                        }
                        //console.log('já existe, não inserir');
                        // }
                    });

                }
                //console.timeEnd('TempoBuscas')
                console.log('FIM ==========|')
            })
        }
        console.log('FINALMENTE GEROU');
    })
    return res.json({ ok: true });
})

async function buscarPorOrderPackId(arrPackIds, seller_id, access_token) {
    let buyers = []

    for (let id in arrPackIds) {
        const res = await fetch(`https://api.mercadolibre.com/messages/packs/${arrPackIds[id].pack_id}/sellers/${seller_id}?access_token=${access_token}&limit=1`);
        if (!res) return;

        const results = await res.json();
        //console.log(results);
        const to = results && results.messages && results.messages[0] && results.messages[0].to ? results.messages[0].to : null;
        if (to && to.email && (!to.email.includes('@splittermp.com') && !to.email.includes('@mail.mercadolivre') && !to.email.includes('@mail.mercadolibre'))) {
            buyers.push({ ...arrPackIds[id].buyer, email: to.email, user_id: to.user_id });
        }
    }
    return buyers;
}


module.exports = routes;