// ExpressとAWS SDKの初期化
const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Expressアプリケーションの作成
const app = express();

// ポート番号を環境変数PORTから取得（未設定の場合は8080）
const port = process.env.PORT || 8080;

// CORS（クロスオリジン）対応
app.use(cors());

// DynamoDBクライアントの初期化（Secrets Managerから取得したREGIONを使用）
const region = process.env.REGION || 'ap-northeast-1';
const client = new DynamoDBClient({ region });
const dynamodb = DynamoDBDocumentClient.from(client);

// 使用するDynamoDBテーブル名（Secrets Managerから取得したDB_TABLE_NAMEを使用）
const tableName = process.env.DB_TABLE_NAME || 'kjtxt-translate-tb';

// ヘルスチェック用エンドポイント（ALBのヘルスチェックに使用）
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 統合された取得API（skjが指定されていれば1件取得、なければ全件取得）
app.get('/kjtxt', async (req, res) => {
    const skj = req.query.skj;

    try {
        if (!skj) {
            // skjが指定されていない場合は全件取得
            const command = new ScanCommand({ TableName: tableName });
            const data = await dynamodb.send(command);

            if (!data.Items || data.Items.length === 0) {
                res.status(404).json("record not found");
            } else {
                const orderedItems = data.Items.map(item => ({
                    skj: item.skj,
                    jkj: item.jkj
                }));
                res.status(200).json(orderedItems);
            }
        } else {
            // skjが指定されている場合は1件取得
            const command = new GetCommand({
                TableName: tableName,
                Key: { skj }
            });
            const data = await dynamodb.send(command);

            if (data.Item && data.Item.jkj !== undefined) {
                res.status(200).json({ jkj: data.Item.jkj });
            } else {
                res.status(404).json("record not found");
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// サーバー起動 コンソールログ出力
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
