# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The standard terms and conditions of easy2edit (Dutch and English). The superadmin can change them in every language (Super admin -> Algemene voorwaarden).
This is a draft text: have it checked by a lawyer before it is used in business."""


def _html(parts):
    out = []
    for kind, text in parts:
        out.append(f"<p><strong>{text}</strong></p>" if kind == "h" else f"<p>{text}</p>" if kind == "p" else "<ul>" + "".join(f"<li>{i}</li>" for i in text) + "</ul>")
    return "html:" + "".join(out)


NL = ("Algemene voorwaarden easy2edit", _html([
    ("p", "Deze voorwaarden gelden voor het gebruik van easy2edit (hierna: het systeem), het eigendom van RST Coaching &amp; Consultancy B.V. (RSTCC). Door deze voorwaarden te ondertekenen verklaart u dat u ze hebt gelezen en dat u het systeem op eigen rekening en risico gebruikt."),
    ("h", "1. Gebruik op eigen rekening en risico"),
    ("p", "U gebruikt easy2edit volledig op eigen rekening en risico. Het systeem wordt geleverd zoals het is (&ldquo;as is&rdquo;), zonder enige garantie op beschikbaarheid, juistheid, geschiktheid voor een bepaald doel of foutloze werking. U bent zelf verantwoordelijk voor alles wat u met het systeem inricht, publiceert, verkoopt of verwerkt, en voor het naleven van de wetten en regels die daarbij gelden."),
    ("h", "2. Beveiliging, hacken en misbruik"),
    ("p", "Geen enkel systeem is volledig veilig. RSTCC doet zijn best om het systeem veilig te houden, maar kan niet garanderen dat het niet wordt gehackt, misbruikt, verstoord of onbereikbaar wordt gemaakt. U bent zelf verantwoordelijk voor de beveiliging van uw installatie, uw server, uw wachtwoorden en uw gebruikers. Dat omvat in elk geval:"),
    ("l", ["het kiezen van sterke, unieke wachtwoorden en het aanzetten van tweestapsverificatie;", "het tijdig installeren van updates van easy2edit, plugins, thema&rsquo;s en de server zelf;", "het beveiligen van de server, de database, de API-sleutels en de toegang voor beheerders;", "het beperken van rechten van gebruikers tot wat zij nodig hebben en het intrekken van toegang die niet meer nodig is."]),
    ("p", "Schade, kosten, boetes of aansprakelijkheid die ontstaan door hacken, datalekken, malware, misbruik van accounts of ongeautoriseerde toegang zijn voor uw eigen rekening en risico."),
    ("h", "3. Gegevensverlies en back-ups"),
    ("p", "U bent zelf verantwoordelijk voor het maken, bewaren en controleren van back-ups van uw website en gegevens. De back-upfuncties van easy2edit zijn hulpmiddelen: zij geven geen garantie dat een back-up volledig, actueel of terug te zetten is. Maak regelmatig back-ups, bewaar ze op een andere plek dan de server en test zo nu en dan of u ze kunt terugzetten. RSTCC is niet aansprakelijk voor verlies, beschadiging of onbereikbaarheid van gegevens, ook niet wanneer dat het gevolg is van een update, een reset, een import, een fout in het systeem, een storing of een handeling van een gebruiker of beheerder."),
    ("h", "4. Handelingen met gevolgen"),
    ("p", "Sommige handelingen, zoals een reset, het installeren van een standaard installatie, het importeren van een website of een back-up, het verwijderen van gegevens of het terugzetten van instellingen, kunnen gegevens vervangen of verwijderen. Controleer vooraf wat er gebeurt en maak eerst een back-up. De gevolgen zijn voor uw eigen rekening en risico."),
    ("h", "5. AI, betalingen en diensten van derden"),
    ("p", "easy2edit kan gebruikmaken van diensten van derden, zoals AI-diensten, betaalproviders (bijvoorbeeld Stripe of Mollie), e-mail- en sms-diensten en opslag. Voor die diensten gelden de voorwaarden van die partijen en u betaalt de kosten ervan. Teksten, afbeeldingen en andere uitkomsten die met AI zijn gemaakt kunnen onjuist, onvolledig of onbedoeld zijn; u controleert ze voordat u ze gebruikt of publiceert. AI-tegoed en betalingen zijn uw eigen verantwoordelijkheid."),
    ("h", "6. Persoonsgegevens"),
    ("p", "U bepaalt welke persoonsgegevens u met het systeem verwerkt en bent daarvoor zelf de verwerkingsverantwoordelijke. U zorgt voor een rechtmatige grondslag, een privacyverklaring, een verwerkersovereenkomst waar dat nodig is en het afhandelen van verzoeken van betrokkenen en meldingen van datalekken."),
    ("h", "7. Beperking van aansprakelijkheid"),
    ("p", "RSTCC is, voor zover de wet dat toestaat, niet aansprakelijk voor directe of indirecte schade, gevolgschade, gederfde winst, verlies van gegevens, bedrijfsstilstand of reputatieschade die voortvloeit uit het gebruik van, of het niet kunnen gebruiken van, het systeem. Is RSTCC ondanks het voorgaande toch aansprakelijk, dan is die aansprakelijkheid beperkt tot het bedrag dat u in de drie maanden voor het schadevoorval aan licentiekosten voor het systeem hebt betaald. Deze beperking geldt niet bij opzet of bewuste roekeloosheid van RSTCC."),
    ("h", "8. Licentie en eigendom"),
    ("p", "easy2edit en de bijbehorende broncode zijn eigendom van RSTCC. U krijgt een niet-exclusief, niet-overdraagbaar recht om het systeem te gebruiken onder de voorwaarden van uw licentie. Kopiëren, aanpassen, verspreiden of commercieel exploiteren zonder schriftelijke toestemming is niet toegestaan. De inhoud die u zelf op uw website zet blijft van u."),
    ("h", "9. Wijzigingen"),
    ("p", "RSTCC kan deze voorwaarden wijzigen. Bij een nieuwe versie moet u opnieuw ondertekenen om beheerder te blijven. Blijft u het systeem gebruiken zonder te ondertekenen, dan is dat niet toegestaan."),
    ("h", "10. Ondertekenen en toepasselijk recht"),
    ("p", "Beheerders en superadmins ondertekenen deze voorwaarden met een code die naar hun e-mailadres wordt gestuurd. De ondertekening wordt vastgelegd met naam, e-mailadres, datum, tijd en versie. Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in Nederland."),
]))

EN = ("Terms and conditions of easy2edit", _html([
    ("p", "These terms apply to the use of easy2edit (the system), owned by RST Coaching &amp; Consultancy B.V. (RSTCC). By signing these terms you confirm that you have read them and that you use the system entirely at your own expense and risk."),
    ("h", "1. Use at your own expense and risk"),
    ("p", "You use easy2edit entirely at your own expense and risk. The system is provided &ldquo;as is&rdquo;, without any warranty of availability, accuracy, fitness for a particular purpose or error-free operation. You are responsible for everything you set up, publish, sell or process with the system, and for complying with the laws and rules that apply to it."),
    ("h", "2. Security, hacking and misuse"),
    ("p", "No system is completely secure. RSTCC does its best to keep the system secure, but cannot guarantee that it will not be hacked, misused, disrupted or made unavailable. You are responsible for the security of your installation, your server, your passwords and your users. This includes at least:"),
    ("l", ["choosing strong, unique passwords and switching on two-step verification;", "installing updates of easy2edit, plugins, themes and the server itself in time;", "securing the server, the database, the API keys and the access of administrators;", "limiting the rights of users to what they need and withdrawing access that is no longer needed."]),
    ("p", "Damage, costs, fines or liability caused by hacking, data breaches, malware, misuse of accounts or unauthorised access are at your own expense and risk."),
    ("h", "3. Data loss and backups"),
    ("p", "You are responsible for making, keeping and checking backups of your website and data. The backup functions of easy2edit are tools: they do not guarantee that a backup is complete, current or can be restored. Make backups regularly, keep them somewhere other than the server and test from time to time that you can restore them. RSTCC is not liable for loss, damage or unavailability of data, not even when it is the result of an update, a reset, an import, an error in the system, a failure or an action of a user or administrator."),
    ("h", "4. Actions with consequences"),
    ("p", "Some actions, such as a reset, installing a standard installation, importing a website or a backup, deleting data or restoring settings, can replace or delete data. Check beforehand what will happen and make a backup first. The consequences are at your own expense and risk."),
    ("h", "5. AI, payments and third-party services"),
    ("p", "easy2edit can use third-party services, such as AI services, payment providers (for example Stripe or Mollie), e-mail and SMS services and storage. The terms of those parties apply to those services and you pay their costs. Texts, images and other results made with AI can be wrong, incomplete or unintended; you check them before you use or publish them. AI credit and payments are your own responsibility."),
    ("h", "6. Personal data"),
    ("p", "You decide which personal data you process with the system and you are the data controller for it. You make sure there is a lawful basis, a privacy statement, a processing agreement where needed, and that requests of data subjects and reports of data breaches are handled."),
    ("h", "7. Limitation of liability"),
    ("p", "To the extent the law allows, RSTCC is not liable for direct or indirect damage, consequential damage, lost profit, loss of data, business interruption or damage to reputation arising from the use of, or the inability to use, the system. If RSTCC is nevertheless liable, that liability is limited to the licence fees you paid for the system in the three months before the event that caused the damage. This limitation does not apply in case of intent or deliberate recklessness of RSTCC."),
    ("h", "8. Licence and ownership"),
    ("p", "easy2edit and its source code are the property of RSTCC. You receive a non-exclusive, non-transferable right to use the system under the terms of your licence. Copying, changing, distributing or commercially exploiting it without written permission is not allowed. The content you put on your own website stays yours."),
    ("h", "9. Changes"),
    ("p", "RSTCC may change these terms. With a new version you must sign again to remain an administrator. Continuing to use the system without signing is not allowed."),
    ("h", "10. Signing and governing law"),
    ("p", "Administrators and superadmins sign these terms with a code that is sent to their e-mail address. The signature is recorded with name, e-mail address, date, time and version. These terms are governed by Dutch law. Disputes are submitted to the competent court in the Netherlands."),
]))

DEFAULTS = {"nl": {"title": NL[0], "body": NL[1]}, "en": {"title": EN[0], "body": EN[1]}}
