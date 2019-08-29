const routes = require('express').Router();
const db = require('./connect');
const fs = require('fs');
require('es6-promise').polyfill();
require('isomorphic-fetch');

routes.get('/buscar-emails', async (req, res) => {
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

                const ordersRes = await fetch(`https://api.mercadolibre.com/orders/search/recent?seller=${seller_id}&access_token=${access_token}`);

                const { results } = await ordersRes.json();


                for (let resu in results) {
                    //console.log(results[resu]);
                    const { pack_id } = results[resu];

                    if (pack_id) {
                        ordersPackId.push({ pack_id, buyer: { ...results[resu].buyer } });
                    }
                }

                if (ordersPackId.length <= 0) return;


                emails.push(...(await buscarPorOrderPackId(ordersPackId, seller_id, access_token)));
                //console.log(seller_id, access_token);
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

                        const apelido = emails[email].nickname,
                            complementoTelefone = emails[email].phone.extension,
                            codigoArea = emails[email].phone.area_code,
                            emailEmail = emails[email].email,
                            idComprador = emails[email].id,
                            name = emails[email].first_name,
                            docNumber = emails[email].billing_info.doc_number,
                            lastName = emails[email].last_name,
                            numeroTelefone = emails[email].phone.number,
                            docType = emails[email].billing_info.doc_type,
                            idConta = seller_id;


                        if (selectEmailsResult.length <= 0) {
                            const insertQuery = `INSERT INTO desmascaradostmp (APELIDO, COMPLEMENTOTELEFONE, DDD, EMAIL, IDCOMPRADOR, NOME, NUMERODOCUMENTO, SOBRENOME, TELEFONE, TIPODOCUMENTO, idConta) VALUES (${apelido}, ${complementoTelefone}, ${codigoArea}, ${emailEmail}, ${idComprador}, ${name}, ${docNumber}, ${lastName}, ${numeroTelefone}, ${docType}, ${idConta});`
                            db.query(insertQuery, async (err, insertResult, field) => {
                                if (err) {
                                    console.log('INSERT ERROR: ', err);
                                }

                                console.log('inseriu');
                            });
                        } else {
                            //console.log('já existe, não inserir');
                        }
                    });
                }
            })
        }

        return res.json({ ok: true });
    })
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