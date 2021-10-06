use anyhow::{format_err, Result};
use async_trait::async_trait;
use serenity::{
    framework::standard::{
        macros::{command, group},
        Args, CommandResult, StandardFramework,
    },
    model::prelude::*,
    prelude::*,
};
use std::{ffi::OsStr, time::Duration};
use thirtyfour::{prelude::*, ChromeCapabilities};

struct Handler;

#[async_trait]
impl EventHandler for Handler {
    async fn ready(&self, _ctx: Context, ready: Ready) {
        println!("{} is connected!", ready.user.name);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    //
    // Force backtraces
    //

    if std::env::var("RUST_LIB_BACKTRACE").is_err() {
        std::env::set_var("RUST_LIB_BACKTRACE", "1")
    }

    //
    // Bot
    //

    // Configure the client with your Discord bot token in the environment.
    let token = std::env::var("DISCORD_TOKEN").expect("Expected a token in the environment");

    let framework = StandardFramework::new()
        .configure(|c| c.prefix("!"))
        .group(&GENERAL_GROUP);

    let mut client = Client::builder(&token)
        .event_handler(Handler)
        .framework(framework)
        .await
        .expect("Err creating client");

    tokio::spawn(async move {
        let _ = client
            .start()
            .await
            .map_err(|why| println!("Client ended: {:?}", why));
    });

    tokio::signal::ctrl_c().await.unwrap();
    println!("Received Ctrl-C, shutting down.");

    Ok(())
}

async fn googe_image(search: &str) -> Result<String> {
    //
    // Create search url
    //

    let mut url =
        url::Url::parse("https://www.google.com/search?source=lnms&tbm=isch&sa=X").unwrap();
    url.query_pairs_mut()
        // .append_pair("safe", "active")
        .append_pair("source", "lnms")
        .append_pair("tbm", "isch")
        .append_pair("sa", "X")
        // .append_pair("tsb", "")
        .append_pair("q", search);

    //
    // Open in browser
    //

    let server_url =
        std::env::var("WEBDRIVER_URL").expect("Expected a webdriver url in the environment");

    let mut caps = ChromeCapabilities::new();
    caps.set_headless()?;
    let mut client = WebDriver::new(&server_url, &caps).await?;
    client
        .set_page_load_timeout(Duration::from_secs(300))
        .await?;
    client
        .set_implicit_wait_timeout(Duration::from_secs(0))
        .await?;
    client.set_script_timeout(Duration::from_secs(300)).await?;

    // Default nowait
    client.config_mut().query_poller = thirtyfour::query::ElementPoller::TimeoutWithInterval(
        Duration::from_secs(300), // 5min timeout for query
        Duration::from_millis(100),
    );

    client.get(url.as_str()).await?;
    let html = client.page_source().await?;

    client.close().await?;

    //
    // Get url
    //

    let document = scraper::Html::parse_document(&html);
    let selector = scraper::Selector::parse("#islrg img").unwrap();
    let element = document
        .select(&selector)
        .next()
        .ok_or_else(|| format_err!("Missing image element"))?;
    let href = element
        .value()
        .attr("src")
        .ok_or_else(|| format_err!("Missing attribut 'href'"))?;
    let link_url = url.join(&href)?;
    println!("Url: {}", link_url.as_str());

    Ok(link_url.to_string())
}

enum EmojiReturn {
    Char(char),
    Emoji(Emoji),
    CustomEmoji(Emoji),
}

async fn get_emoji(ctx: &Context, msg: &Message, arg_emoji: &str) -> Result<EmojiReturn> {
    //
    // Is emoji character
    if let Some(emoji) = ::emoji::lookup_by_glyph::lookup(&arg_emoji) {
        println!(" - Char: {:?}", emoji);
        return Ok(EmojiReturn::Char(emoji.glyph.chars().next().unwrap()));
    }

    // is emoji name
    // because names don't contain _ and remove :
    if let Some(emoji) =
        emoji::lookup_by_name::lookup(&arg_emoji.replace('_', " ").replace(':', ""))
    {
        println!(" - Name: {:?}", emoji);
        return Ok(EmojiReturn::Char(emoji.glyph.chars().next().unwrap()));
    }

    let guild = msg
        .guild(&ctx.cache)
        .await
        .ok_or_else(|| format_err!("Unknown guild"))?;

    // is guild emoji - find by name
    if let Some((_id, emoji)) = guild.emojis.iter().find(|(id, emoji)| {
        emoji.name.eq_ignore_ascii_case(&arg_emoji)
            || id.to_string().eq_ignore_ascii_case(&arg_emoji)
    }) {
        println!(" - Guild: {:?}", emoji);
        return Ok(EmojiReturn::Emoji(emoji.clone()));
    }

    // is guild emoji - find by emoji identifier
    if let Some((_id, emoji)) = serenity::utils::parse_emoji(&arg_emoji).and_then(|identifier| {
        guild.emojis.iter().find(|(id, emoji)| {
            println!("{:?}", id);
            id == &&identifier.id || emoji.name.eq_ignore_ascii_case(&identifier.name)
        })
    }) {
        println!(" - Guild2: {:?}", emoji);
        return Ok(EmojiReturn::Emoji(emoji.clone()));
    }

    let arg_emoji = arg_emoji.trim();

    if arg_emoji.len() < 2 {
        return Err(format_err!("Emoji name must have at least 2 characters"));
    }

    // Search google
    let emoji_google_data = googe_image(&arg_emoji).await?;

    let arg_emoji = arg_emoji.replace(char::is_whitespace, "_");
    let emoji = guild
        .create_emoji(&ctx.http, &arg_emoji, &emoji_google_data)
        .await?;

    Ok(EmojiReturn::CustomEmoji(emoji))
}

#[group]
#[commands(emoji)]
struct General;

#[command]
#[only_in(guilds)]
async fn emoji(ctx: &Context, msg: &Message, args: Args) -> CommandResult {
    match emoji_internal(ctx, msg, args).await {
        Ok(_) => {}
        Err(err) => {
            println!("[Error] {:?}", &err);
            println!("[Error] {}", &err);
            msg.reply(&ctx.http, format!("[Error] {:?}", err)).await?;
        }
    }

    Ok(())
}

async fn emoji_internal(ctx: &Context, msg: &Message, args: Args) -> anyhow::Result<()> {
    //
    // Parse arguments
    //

    let arg_emoji = serenity::utils::parse_quotes(
        args.parse::<String>()
            .map_err(|_| format_err!("Missing/Invalid <emoji> argumnet (must be a string)"))?,
    )
    .pop()
    .ok_or_else(|| format_err!("Feiled parsing quotes"))?;
    println!("Arg: {:?}", arg_emoji);

    //
    // Reply emoji
    //

    match get_emoji(&ctx, &msg, &arg_emoji).await? {
        EmojiReturn::Char(emoji) => {
            msg.react(&ctx.http, emoji).await?;
        }
        EmojiReturn::Emoji(emoji) => {
            msg.react(&ctx.http, emoji).await?;
        }
        EmojiReturn::CustomEmoji(emoji) => {
            msg.react(&ctx.http, emoji.clone()).await?;
            let guild = msg
                .guild(&ctx.cache)
                .await
                .ok_or_else(|| format_err!("Unknown guild"))?;
            guild.delete_emoji(&ctx.http, &emoji.id).await?;
        }
    };

    //

    // msg.reply(&ctx, format!("Data: `{:?}`", emoji_id)).await?;
    // println!("Emoji: {:?}", emoji_id);

    //
    // Check if valid emoji
    //

    /*

    let emoji = serenity::utils::parse_emoji(emoji_id)
        .ok_or_else(|| format_err!("Unknwon emoji (emoji parse)"))?;
    msg.react(&ctx.http, emoji).await?;

    let emoji = guild
        .emojis
        .iter()
        .find(|(k, v)| {
            println!("{:?}: {:?}", k, v);
            false
        })
        .ok_or_else(|| format_err!("Unknown emoji"))?;*/

    //
    // Find google search
    //

    //
    // Add custom emoji
    //

    //
    // React
    //

    Ok(())
}
